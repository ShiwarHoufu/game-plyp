/**
 * 数据库配置
 * 从环境变量读取（由 index.js 通过 dotenv 从 server/.env 加载）。
 * 敏感信息不硬编码在代码中，缺失时直接报错，避免静默连错库。
 */

const REQUIRED_ENV = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    throw new Error(
        `[database] 缺少必要的环境变量: ${missingEnv.join(', ')}。` +
        `请确认 server/.env 文件存在并包含上述配置。`
    );
}

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
};

// 端口校验，避免非数字导致 mysql2 抛出难懂的错误
if (Number.isNaN(dbConfig.port)) {
    throw new Error(`[database] DB_PORT 必须是数字，当前值: ${process.env.DB_PORT}`);
}

module.exports = dbConfig;
