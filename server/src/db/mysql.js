/**
 * MySQL 数据库连接池
 */
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

let pool = null;

/**
 * 获取连接池实例
 */
function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            waitForConnections: true,
            connectionLimit: dbConfig.connectionLimit || 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
    }
    return pool;
}

/**
 * 执行查询
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 * @returns {Promise<Array>} 查询结果
 */
async function query(sql, params = []) {
    const pool = getPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
}

/**
 * 获取单个连接
 * @returns {Promise<Connection>}
 */
async function getConnection() {
    const pool = getPool();
    return await pool.getConnection();
}

/**
 * 关闭连接池
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = {
    getPool,
    query,
    getConnection,
    close
};
