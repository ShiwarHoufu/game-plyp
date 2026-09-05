/**
 * 商店路由
 * GET  /api/shop/items - 获取商店物品列表
 * POST /api/shop/purchase - 购买物品
 * GET  /api/shop/inventory - 获取用户背包
 * GET  /api/shop/equipped - 获取已装备皮肤
 * POST /api/shop/equip - 装备皮肤
 * GET  /api/shop/coins - 获取用户金币
 */
const express = require('express');
const db = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/shop/items
 * 获取商店物品列表
 */
router.get('/items', requireAuth, async (req, res) => {
    try {
        const items = await db.query(
            `SELECT item_id, item_type, name, price, image_path,
                    is_default
             FROM shop_items
             ORDER BY item_type, sort_order ASC`
        );

        const userId = req.user.userId;
        const inventory = await db.query(
            'SELECT item_id FROM user_inventory WHERE user_id = ?',
            [userId]
        );
        const ownedItems = new Set(inventory.map(i => i.item_id));

        const currencyResult = await db.query(
            'SELECT coins FROM user_currency WHERE user_id = ?',
            [userId]
        );
        const userCoins = currencyResult.length > 0 ? currencyResult[0].coins : 0;

        const itemsWithStatus = items.map(item => ({
            ...item,
            isOwned: ownedItems.has(item.item_id) || item.is_default === 1,
            isPurchasable: !ownedItems.has(item.item_id) && item.is_default !== 1
        }));

        res.json({
            success: true,
            items: itemsWithStatus,
            userCoins
        });

    } catch (error) {
        console.error('获取商店物品错误:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: '服务器错误' }
        });
    }
});

/**
 * POST /api/shop/purchase
 * 购买物品
 */
router.post('/purchase', requireAuth, async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const userId = req.user.userId;
        const { itemId } = req.body;

        if (!itemId) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: '物品ID不能为空' }
            });
        }

        const [items] = await connection.query(
            'SELECT * FROM shop_items WHERE item_id = ?',
            [itemId]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: { code: 'ITEM_NOT_FOUND', message: '物品不存在' }
            });
        }

        const item = items[0];

        const [owned] = await connection.query(
            'SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ?',
            [userId, itemId]
        );

        if (owned.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: { code: 'ALREADY_OWNED', message: '已拥有该物品' }
            });
        }

        const [currency] = await connection.query(
            'SELECT coins FROM user_currency WHERE user_id = ?',
            [userId]
        );

        const userCoins = currency.length > 0 ? currency[0].coins : 0;

        if (userCoins < item.price) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: { code: 'INSUFFICIENT_COINS', message: '金币不足' }
            });
        }

        await connection.query(
            'UPDATE user_currency SET coins = coins - ? WHERE user_id = ?',
            [item.price, userId]
        );

        await connection.query(
            'INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)',
            [userId, itemId]
        );

        await connection.query(
            'INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)',
            [userId, -item.price, 'purchase']
        );

        await connection.commit();

        const [updatedCurrency] = await connection.query(
            'SELECT coins FROM user_currency WHERE user_id = ?',
            [userId]
        );

        res.json({
            success: true,
            message: '购买成功',
            item: {
                itemId: item.item_id,
                name: item.name
            },
            remainingCoins: updatedCurrency[0].coins
        });

    } catch (error) {
        await connection.rollback();
        console.error('购买物品错误:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: '服务器错误' }
        });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/shop/inventory
 * 获取用户背包
 */
router.get('/inventory', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;

        const inventory = await db.query(
            `SELECT ui.item_id, ui.purchased_at,
                    si.item_type, si.name, si.image_path, si.price
             FROM user_inventory ui
             JOIN shop_items si ON ui.item_id = si.item_id
             WHERE ui.user_id = ?
             ORDER BY ui.purchased_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            inventory
        });

    } catch (error) {
        console.error('获取背包错误:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: '服务器错误' }
        });
    }
});

/**
 * GET /api/shop/owned-skins
 * 获取用户拥有的棋子皮肤（用于颜色选择阶段）
 */
router.get('/owned-skins', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;

        const skins = await db.query(
            `SELECT si.item_id, si.name, si.image_path
             FROM user_inventory ui
             JOIN shop_items si ON ui.item_id = si.item_id
             WHERE ui.user_id = ? AND si.item_type = 'piece_skin'
             ORDER BY si.sort_order ASC`,
            [userId]
        );

        res.json({
            success: true,
            skins
        });

    } catch (error) {
        console.error('获取拥有皮肤错误:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: '服务器错误' }
        });
    }
});

/**
 * GET /api/shop/owned-trails
 * 获取用户拥有的拖尾效果（用于准备阶段）
 */
router.get('/owned-trails', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;

        const trails = await db.query(
            `SELECT si.item_id, si.name
             FROM user_inventory ui
             JOIN shop_items si ON ui.item_id = si.item_id
             WHERE ui.user_id = ? AND si.item_type = 'trail_effect'
             ORDER BY si.sort_order ASC`,
            [userId]
        );

        res.json({
            success: true,
            trails
        });

    } catch (error) {
        console.error('获取拥有拖尾效果错误:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: '服务器错误' }
        });
    }
});

/**
 * GET /api/shop/coins
 * 获取用户金币
 */
router.get('/coins', requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;

        const [currency] = await db.query(
            'SELECT coins FROM user_currency WHERE user_id = ?',
            [userId]
        );

        const coins = currency.length > 0 ? currency[0].coins : 0;

        res.json({
            success: true,
            coins
        });

    } catch (error) {
        console.error('获取金币错误:', error);
        res.status(500).json({
            success: false,
            error: { code: 'SERVER_ERROR', message: '服务器错误' }
        });
    }
});

function isWithinTimeRange(startDate, endDate) {
    if (!startDate || !endDate) return true;
    const now = new Date();
    return now >= new Date(startDate) && now <= new Date(endDate);
}

module.exports = router;
