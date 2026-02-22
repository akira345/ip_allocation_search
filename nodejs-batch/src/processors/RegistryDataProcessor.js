import IpCalculator from '../utils/IpCalculator.js';
import { Agent, setGlobalDispatcher } from 'undici';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const dispatcher = new Agent({
  connect: {
    family: 4, // IPV4優先
  },
});

// fetch 全体に適用
setGlobalDispatcher(dispatcher);

/**
 * レジストリデータ処理クラス
 * 各地域レジストリからデータをダウンロード・解析してデータベース形式に変換
 */
class RegistryDataProcessor {
  /**
   * コンストラクタ
   * @param {DatabaseManager} dbManager - データベースマネージャーインスタンス
   */
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.registryCache = new Map(); // レジストリ設定のキャッシュ
  }

  /**
   * データベースからレジストリ設定を取得
   * @returns {Promise<Map>} レジストリ設定のMap
   */
  async loadRegistryConfigs() {
    if (!this.dbManager.connection) {
      await this.dbManager.connect();
    }

    try {
      const [rows] = await this.dbManager.connection.execute(`
        SELECT 
          registry_code,
          registry_name,
          region,
          url,
          data_source_url,
          is_active
        FROM registries 
        WHERE is_active = TRUE
        ORDER BY registry_code
      `);

      const registries = new Map();

      for (const row of rows) {
        const config = {
          name: row.registry_name,
          region: row.region,
          url: row.data_source_url || row.url,
          hasExtendedFormat: row.registry_code === 'arin', // ARINのみ拡張フォーマット
        };

        registries.set(row.registry_code, config);
      }

      // キャッシュに保存
      this.registryCache = registries;

      console.log(`📋 ${registries.size}個のアクティブなレジストリを読み込みました`);
      return registries;
    } catch (error) {
      console.error('❌ レジストリ設定読み込みエラー:', error.message);
      throw error;
    }
  }

  /**
   * 利用可能なレジストリ一覧を取得
   * @returns {Promise<Array<string>>} レジストリコードの配列
   */
  async getAvailableRegistries() {
    if (this.registryCache.size === 0) {
      await this.loadRegistryConfigs();
    }
    return Array.from(this.registryCache.keys());
  }

  /**
   * 指定レジストリのデータを処理
   * @param {string} registryKey - レジストリキー
   * @param {Object} options - 処理オプション
   * @returns {Promise<Object>} 処理結果
   */
  async processRegistry(registryKey, options = {}) {
    // レジストリ設定を動的に取得
    if (this.registryCache.size === 0) {
      await this.loadRegistryConfigs();
    }

    const registry = this.registryCache.get(registryKey);
    if (!registry) {
      throw new Error(`不明またはアクティブでないレジストリ: ${registryKey}`);
    }

    console.log(`🚀 ${registry.name} データ処理開始...`);
    if (options.testMode) {
      console.log(`🧪 テストモード: IPv4=${options.ipv4Limit}件, IPv6=${options.ipv6Limit}件で制限`);
    }
    const startTime = Date.now();

    try {
      // 処理開始ログを記録
      await this._logProcessStart(registryKey);

      // データダウンロード
      const data = await this._downloadData(registry);

      // データ解析
      const records = this._parseData(data, registryKey, registry.hasExtendedFormat, options);

      // データベースに挿入
      const insertedCount = await this._insertToDatabase(records, registryKey);

      // 完了ログを記録
      const executionTime = Math.floor((Date.now() - startTime) / 1000);
      await this._logProcessComplete(registryKey, insertedCount, executionTime);

      console.log(`✅ ${registry.name} 処理完了: ${insertedCount}件処理 (${executionTime}秒)`);

      return {
        success: true,
        registry: registryKey,
        recordsProcessed: insertedCount,
        executionTime,
      };
    } catch (error) {
      // エラーログを記録
      await this._logProcessError(registryKey, error.message);
      console.error(`❌ ${registry.name} 処理エラー:`, error.message);

      return {
        success: false,
        registry: registryKey,
        error: error.message,
      };
    }
  }

  /**
   * レジストリからデータをダウンロードする（プライベートメソッド）
   * リトライ機能付き（最大3回）
   * @private
   * @param {Object} registry - レジストリ設定オブジェクト
   * @returns {Promise<string>} ダウンロードしたデータ
   * @throws {Error} ダウンロードエラー時
   */
  async _downloadData(registry) {
    const url = registry.url;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        console.log(`📥 ダウンロード中 (試行 ${attempt}/${maxRetries}): ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分タイムアウト

        const response = await fetch(url, {
          method: 'GET',

          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IP-Registry-Processor/1.0)',
            Accept: 'text/plain, */*',
            'Accept-Encoding': 'gzip, deflate',
            Connection: 'keep-alive',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`📊 レスポンス受信開始 - Content-Length: ${response.headers.get('content-length') || 'unknown'}`);

        const text = await response.text();
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);

        console.log(`✅ ダウンロード完了: ${(text.length / 1024 / 1024).toFixed(1)}MB (${elapsedTime}秒)`);
        return text;
      } catch (error) {
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const isLastAttempt = attempt === maxRetries;

        console.error(`❌ ダウンロード失敗 (試行 ${attempt}/${maxRetries}) - ${elapsedTime}秒で失敗:`, {
          message: error.message,
          name: error.name,
          cause: error.cause?.code || error.cause?.message || 'unknown',
        });

        if (!isLastAttempt) {
          const waitTime = attempt * 2; // 2, 4秒で段階的に待機
          console.log(`🔄 ${waitTime}秒後にリトライします...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
          continue;
        }

        // 全ての試行が失敗した場合はエラーをスロー
        console.error(`❌ 全ての試行が失敗しました: ${url}`);
        throw error;
      }
    }
  }

  /**
   * ダウンロードしたデータを解析してレコード適数を生成する（プライベートメソッド）
   * @private
   * @param {string} data - レジストリの生データ
   * @param {string} registryKey - レジストリコード
   * @param {boolean} hasExtendedFormat - 拡張フォーマット対応フラグ
   * @param {Object} options - 解析オプション
   * @returns {Array<Array<Object>>} 解析されたレコード配列
   */
  _parseData(data, registryKey, hasExtendedFormat, options = {}) {
    const lines = data.split('\n');
    const records = [];

    console.log(`📊 データ解析中... (${lines.length}行)`);

    // テストモード用カウンタ
    let ipv4Count = 0;
    let ipv6Count = 0;
    const ipv4Limit = options.ipv4Limit || Infinity;
    const ipv6Limit = options.ipv6Limit || Infinity;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 空行やコメント行をスキップ
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const parts = trimmedLine.split('|');

      // 最低限の項目数チェック
      if (parts.length < 7) {
        continue;
      }

      const [, country, type, ip, value, date, status, ...extended] = parts;

      // IPv4/IPv6のみ処理、サマリー行はスキップ
      if ((type !== 'ipv4' && type !== 'ipv6') || date === 'summary') {
        continue;
      }

      // テストモードでの制限チェック
      if (options.testMode) {
        if (type === 'ipv4' && ipv4Count >= ipv4Limit) {
          continue;
        }
        if (type === 'ipv6' && ipv6Count >= ipv6Limit) {
          continue;
        }
      }

      try {
        const record = this._parseRecord({
          registry: registryKey,
          country,
          type,
          ip,
          value: parseInt(value, 10),
          date,
          status,
          extended: hasExtendedFormat ? extended[0] : null,
        });

        if (record) {
          records.push(record);

          // カウンタ更新（通常モード・テストモード共通）
          if (type === 'ipv4') ipv4Count++;
          if (type === 'ipv6') ipv6Count++;
        }
      } catch (error) {
        console.warn(`⚠️  解析スキップ: ${trimmedLine.substring(0, 50)}... (${error.message})`);
      }

      // テストモードで制限に達したら終了
      if (options.testMode && ipv4Count >= ipv4Limit && ipv6Count >= ipv6Limit) {
        console.log(`🧪 テスト制限に達しました: IPv4=${ipv4Count}件, IPv6=${ipv6Count}件`);
        break;
      }
    }

    console.log(`✅ 解析完了: ${records.length}件のレコード (IPv4: ${ipv4Count}件, IPv6: ${ipv6Count}件)`);
    return records;
  }

  /**
   * 個別レコードを解析してデータベース用オブジェクトに変換する（プライベートメソッド）
   * @private
   * @param {Object} data - 解析対象データ
   * @param {string} data.registry - レジストリコード
   * @param {string} data.country - 国コード
   * @param {string} data.type - IPバージョンタイプ
   * @param {string} data.ip - IPアドレス
   * @param {number} data.value - IP数またはプレフィックス長
   * @param {string} data.date - 割り当て日
   * @param {string} data.status - ステータス
   * @param {string|null} data.extended - 拡張フィールド（ARIN用）
   * @returns {Array<Object>|null} データベースレコード配列
   */
  _parseRecord(data) {
    const ipVersion = data.type === 'ipv4' ? 4 : 6;
    const allocationDate = this._parseDate(data.date);

    // IPv4の場合は個数から複数のCIDRブロックを生成
    if (ipVersion === 4) {
      const cidrBlocks = IpCalculator.ipv4RangeToCidr(data.ip, data.value);

      return cidrBlocks.map((cidr) => {
        const range = IpCalculator.calculateCidrRange(cidr);
        return {
          registry: data.registry,
          country_code: data.country,
          ip_version: ipVersion,
          ip_address_text: data.ip,
          ip_start_text: range.startIp,
          ip_end_text: range.endIp,
          address_count: data.value,
          allocation_date: allocationDate,
          status: data.status,
          netblock_cidr: cidr,
          prefix_length: IpCalculator.getPrefixLength(cidr),
        };
      });
    }

    // IPv6の場合
    else if (ipVersion === 6) {
      const prefixLength = parseInt(data.value, 10);
      const cidr = `${data.ip}/${prefixLength}`;
      const range = IpCalculator.calculateCidrRange(cidr);

      return [
        {
          registry: data.registry,
          country_code: data.country,
          ip_version: ipVersion,
          ip_address_text: data.ip,
          ip_start_text: range.startIp,
          ip_end_text: range.endIp,
          address_count: Math.min(Math.pow(2, Math.min(128 - prefixLength, 32)), 4294967295), // IPv6アドレス数（上限を32ビット整数に制限）
          allocation_date: allocationDate,
          status: data.status,
          netblock_cidr: cidr,
          prefix_length: prefixLength,
        },
      ];
    }

    return null;
  }

  /**
   * YYYYMMDD形式の日付文字列をYYYY-MM-DD形式に変換する（プライベートメソッド）
   * @private
   * @param {string} dateStr - YYYYMMDD形式の日付文字列
   * @returns {string|null} YYYY-MM-DD形式の日付またはnull
   */
  _parseDate(dateStr) {
    if (!dateStr || dateStr === '00000000') {
      return null;
    }

    try {
      // YYYYMMDD形式
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
    } catch {
      console.warn(`日付解析エラー: ${dateStr}`);
    }

    return null;
  }

  /**
   * 解析したレコードをデータベースのトランザクションテーブルにバッチ挿入する（プライベートメソッド）
   * @private
   * @param {Array<Array<Object>>} records - 挿入対象レコード配列
   * @param {string} registryKey - レジストリコード
   * @returns {Promise<number>} 挿入されたレコード数
   * @throws {Error} データベース挿入エラー時
   */
  async _insertToDatabase(records, registryKey) {
    if (!this.dbManager.connection) {
      await this.dbManager.connect();
    }

    // トランザクション開始
    await this.dbManager.beginTransaction();

    try {
      // 既存データをクリア
      await this.dbManager.connection.execute('DELETE FROM ip_allocations_trn WHERE registry = ?', [registryKey]);

      let insertedCount = 0;

      // バッチ挿入（1000件ずつ）
      const batchSize = 1000;
      const flatRecords = records.flat(); // IPv4の場合に複数レコードになるため平坦化

      console.log(`📝 データベース挿入中... (${flatRecords.length}件)`);

      for (let i = 0; i < flatRecords.length; i += batchSize) {
        const batch = flatRecords.slice(i, i + batchSize);
        // INET6_ATONはIPV4/6両対応
        const placeholders = batch
          .map(() => '(?, ?, ?, INET6_ATON(?), ?, INET6_ATON(?), INET6_ATON(?), ?, ?, ?, ?, ?)')
          .join(', ');
        const sql = `
          INSERT INTO ip_allocations_trn 
          (registry, country_code, ip_version, ip_address_binary, ip_address_text, 
           ip_start_binary, ip_end_binary, address_count, allocation_date, status, netblock_cidr, prefix_length)
          VALUES ${placeholders}
        `;

        const values = batch.flatMap((record) => [
          record.registry,
          record.country_code,
          record.ip_version,
          record.ip_address_text, // INET6_ATON()で変換
          record.ip_address_text,
          record.ip_start_text, // 開始IPをINET6_ATON()で変換
          record.ip_end_text, // 終了IPをINET6_ATON()で変換
          record.address_count,
          record.allocation_date,
          record.status,
          record.netblock_cidr,
          record.prefix_length,
        ]);

        await this.dbManager.connection.execute(sql, values);
        insertedCount += batch.length;

        // 進捗表示
        if (i % 5000 === 0) {
          console.log(`  📊 挿入済み: ${insertedCount}/${flatRecords.length}件`);
        }
      }

      await this.dbManager.commit();
      console.log(`✅ データベース挿入完了: ${insertedCount}件`);

      return insertedCount;
    } catch (error) {
      await this.dbManager.rollback();
      console.error('❌ データベース挿入エラー:', error.message);
      throw error;
    }
  }

  /**
   * 処理開始ログを記録する（プライベートメソッド）
   * @private
   * @param {string} registry - レジストリコード
   * @returns {Promise<void>}
   */
  async _logProcessStart(registry) {
    const sql = `
      INSERT INTO processing_logs (registry, process_date, status, records_processed)
      VALUES (?, CURDATE(), 'started', 0)
    `;
    await this.dbManager.connection.execute(sql, [registry]);
  }

  /**
   * 処理完了ログを記録する（プライベートメソッド）
   * @private
   * @param {string} registry - レジストリコード
   * @param {number} recordsProcessed - 処理したレコード数
   * @param {number} executionTime - 実行時間（秒）
   * @returns {Promise<void>}
   */
  async _logProcessComplete(registry, recordsProcessed, executionTime) {
    const sql = `
      UPDATE processing_logs 
      SET status = 'completed', records_processed = ?, execution_time_seconds = ?
      WHERE registry = ? AND process_date = CURDATE() AND status = 'started'
    `;
    await this.dbManager.connection.execute(sql, [recordsProcessed, executionTime, registry]);
  }

  /**
   * 処理エラーログを記録する（プライベートメソッド）
   * @private
   * @param {string} registry - レジストリコード
   * @param {string} errorMessage - エラーメッセージ
   * @returns {Promise<void>}
   */
  async _logProcessError(registry, errorMessage) {
    const sql = `
      UPDATE processing_logs 
      SET status = 'failed', error_message = ?
      WHERE registry = ? AND process_date = CURDATE() AND status = 'started'
    `;
    await this.dbManager.connection.execute(sql, [errorMessage, registry]);
  }
}

export default RegistryDataProcessor;
