const yargs = require("yargs");
const readline = require("readline");
const DatabaseManager = require("./utils/DatabaseManager");
const RegistryDataProcessor = require("./processors/RegistryDataProcessor");

/**
 * ユーザー確認を求める関数
 */
async function askConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * メイン実行関数
 */
async function main() {
  const argv = yargs
    .option("registry", {
      alias: "r",
      type: "string",
      description: "処理対象レジストリ",
      choices: ["afrinic", "apnic", "arin", "lacnic", "ripencc"],
    })
    .option("parallel", {
      alias: "p",
      type: "boolean",
      description: "全レジストリを並列処理",
      default: false,
    })
    .option("test-mode", {
      alias: "t",
      type: "boolean",
      description: "テストモード（制限数での実行）",
      default: false,
    })
    .option("ipv4-limit", {
      type: "number",
      description: "IPv4処理制限数（テストモード用）",
      default: 300,
    })
    .option("ipv6-limit", {
      type: "number",
      description: "IPv6処理制限数（テストモード用）",
      default: 200,
    })
    .option("environment", {
      alias: "e",
      type: "string",
      description: "実行環境",
      choices: ["development", "production", "production2"],
    })
    .option("migrate", {
      alias: "m",
      type: "boolean",
      description: "データベース初期化実行",
      default: false,
    })
    .demandOption(
      ["environment"],
      "❌ 実行環境の指定は必須です。-e または --environment オプションで指定してください。"
    )
    .help()
    .alias("help", "h").argv;

  const finalDbManager = new DatabaseManager(argv.environment);

  try {
    console.log("🚀 IP Registry Data Processor 開始...");
    console.log(`📊 環境: ${argv.environment}`);

    // マイグレーション専用処理
    if (argv.migrate) {
      console.log("⚠️  データベースマイグレーションを実行します。");
      console.log("⚠️  既存のデータが削除される可能性があります。");

      const confirmed = await askConfirmation(
        "この操作を続行しますか？ (y/N): "
      );

      if (!confirmed) {
        console.log("❌ マイグレーション処理がキャンセルされました。");
        return;
      }

      console.log("🔧 マイグレーション実行中...");
      await finalDbManager.migrate();
      await finalDbManager.checkTables();
      console.log("✅ マイグレーション完了");

      // マイグレーション後は処理を終了
      return;
    }

    // 通常のデータ処理
    await finalDbManager.connect();

    const finalProcessor = new RegistryDataProcessor(finalDbManager);
    const startTime = Date.now();

    // テストモードのオプション準備
    const processOptions = {
      testMode: argv["test-mode"],
      ipv4Limit: argv["ipv4-limit"],
      ipv6Limit: argv["ipv6-limit"],
    };

    if (argv["test-mode"]) {
      console.log(
        `🧪 テストモード有効 - IPv4制限: ${processOptions.ipv4Limit}件, IPv6制限: ${processOptions.ipv6Limit}件`
      );
    }

    // 単一レジストリ処理
    if (argv.registry) {
      console.log(`📋 単一レジストリ処理: ${argv.registry}`);
      const result = await finalProcessor.processRegistry(
        argv.registry,
        processOptions
      );

      if (result.success) {
        await finalizeRegistry(finalDbManager, argv.registry);
      }

      displayResults([result]);
    }

    // 全レジストリ処理
    else {
      const registries = await finalProcessor.getAvailableRegistries();

      if (registries.length === 0) {
        console.log("⚠️  アクティブなレジストリが見つかりません");
        return;
      }

      console.log(`📋 処理対象レジストリ: ${registries.join(", ")}`);
      const results = [];

      if (argv.parallel) {
        console.log("🔄 全レジストリ並列処理...");
        const promises = registries.map((reg) =>
          finalProcessor.processRegistry(reg, processOptions)
        );
        const parallelResults = await Promise.allSettled(promises);

        for (let i = 0; i < parallelResults.length; i++) {
          if (parallelResults[i].status === "fulfilled") {
            results.push(parallelResults[i].value);
            if (parallelResults[i].value.success) {
              await finalizeRegistry(finalDbManager, registries[i]);
            }
          } else {
            results.push({
              success: false,
              registry: registries[i],
              error: parallelResults[i].reason.message,
            });
          }
        }
      } else {
        console.log("🔄 全レジストリ順次処理...");
        for (const registry of registries) {
          const result = await finalProcessor.processRegistry(
            registry,
            processOptions
          );
          results.push(result);

          if (result.success) {
            await finalizeRegistry(finalDbManager, registry);
          }
        }
      }

      displayResults(results);
    }

    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    console.log(`⏱️  総処理時間: ${totalTime}秒`);
    console.log("✅ 処理完了");
  } catch (error) {
    console.error("❌ 処理中にエラーが発生しました:", error.message);
    process.exit(1);
  } finally {
    await finalDbManager.disconnect();
  }
}

/**
 * レジストリデータをトランザクションテーブルから本テーブルに移行
 */
async function finalizeRegistry(dbManager, registry) {
  console.log(`🔄 ${registry} データを本テーブルに移行中...`);

  try {
    await dbManager.beginTransaction();

    // 本テーブルの既存データを削除
    await dbManager.connection.execute(
      "DELETE FROM ip_allocations WHERE registry = ?",
      [registry]
    );

    // トランザクションテーブルから本テーブルに移行
    const sql = `
      INSERT INTO ip_allocations (
        registry, country_code, ip_version, ip_address_binary, ip_address_text,
        ip_start_binary, ip_end_binary, address_count, allocation_date, status, netblock_cidr, prefix_length
      )
      SELECT 
        registry, country_code, ip_version, ip_address_binary, ip_address_text,
        ip_start_binary, ip_end_binary, address_count, allocation_date, status, netblock_cidr, prefix_length
      FROM ip_allocations_trn 
      WHERE registry = ?
    `;

    const [result] = await dbManager.connection.execute(sql, [registry]);
    await dbManager.commit();

    console.log(`✅ ${registry} データ移行完了: ${result.affectedRows}件`);
  } catch (error) {
    await dbManager.rollback();
    console.error(`❌ ${registry} データ移行エラー:`, error.message);
    throw error;
  }
}

/**
 * 処理結果表示
 */
function displayResults(results) {
  console.log("\n📊 処理結果サマリー");
  console.log("=".repeat(50));

  let totalRecords = 0;
  let successCount = 0;

  for (const result of results) {
    const status = result.success ? "✅ 成功" : "❌ 失敗";
    const records = result.recordsProcessed || 0;
    const time = result.executionTime || 0;
    const error = result.error ? ` (${result.error})` : "";

    console.log(
      `${result.registry.toUpperCase().padEnd(8)} ${status} ${records
        .toLocaleString()
        .padStart(8)}件 ${time.toString().padStart(4)}秒${error}`
    );

    if (result.success) {
      totalRecords += records;
      successCount++;
    }
  }

  console.log("=".repeat(50));
  console.log(
    `合計: ${successCount}/${
      results.length
    } レジストリ成功, ${totalRecords.toLocaleString()} 件処理`
  );
}

// スクリプトが直接実行された場合
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 予期しないエラー:", error);
    process.exit(1);
  });
}

module.exports = { main, finalizeRegistry };
