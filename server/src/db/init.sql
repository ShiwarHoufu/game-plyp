-- 碰了又碰 数据库初始化脚本

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS plyp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE plyp_db;

-- 用户账户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 玩家战绩表（按模式统计）
CREATE TABLE IF NOT EXISTS player_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_mode ENUM('classic', 'skill', 'chaos', 'chaos4') NOT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    total_games INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_mode (user_id, game_mode),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 游戏历史记录
CREATE TABLE IF NOT EXISTS game_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_mode ENUM('classic', 'skill', 'chaos', 'chaos4') NOT NULL,
    rounds INT NOT NULL,
    result ENUM('win', 'loss') NOT NULL,
    opponent_username VARCHAR(50) DEFAULT NULL,
    piece_count INT DEFAULT NULL,
    generate_terrain TINYINT(1) DEFAULT 0,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_mode (user_id, game_mode),
    INDEX idx_played_at (played_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SHOP AND INVENTORY SYSTEM TABLES
-- =====================================================

-- 用户货币表（金币）
CREATE TABLE IF NOT EXISTS user_currency (
    user_id INT PRIMARY KEY,
    coins INT DEFAULT 100,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商品表（商店物品）
CREATE TABLE IF NOT EXISTS shop_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_type ENUM('piece_skin', 'board_skin', 'trail_effect') NOT NULL,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    image_path VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    is_limited BOOLEAN DEFAULT FALSE,
    start_date DATETIME,
    end_date DATETIME,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item_type (item_type),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户库存表（已购买的物品）
CREATE TABLE IF NOT EXISTS user_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES shop_items(item_id),
    UNIQUE KEY unique_user_item (user_id, item_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 金币交易记录表
CREATE TABLE IF NOT EXISTS coin_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    reason ENUM('win_reward', 'purchase', 'daily_login', 'admin_grant') NOT NULL,
    reference_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 棋子皮肤：使用 assets/images/piece/ 下的图片
INSERT INTO shop_items (item_type, item_id, name, price, image_path, is_default, sort_order) VALUES
('piece_skin', 'yellow-box', '黄盒', 30, 'assets/images/piece/yellow-box.png', FALSE, 1),
('piece_skin', 'blue-box', '蓝盒', 50, 'assets/images/piece/blue-box.png', FALSE, 2),
('piece_skin', 'red-box', '红盒', 50, 'assets/images/piece/red-box.png', FALSE, 3),
('piece_skin', 'cyber', 'Cyber', 100, 'assets/images/piece/cyber.png', FALSE, 4),
('piece_skin', 'volleyball', '排球', 50, 'assets/images/piece/volleyball.png', FALSE, 5),
('piece_skin', 'basketball', '篮球', 80, 'assets/images/piece/basketball.png', FALSE, 6),
('piece_skin', 'recycle', '可回收', 100, 'assets/images/piece/recycle.png', FALSE, 7),
('piece_skin', 'rainbow_ring', '霓虹流光', 100, 'assets/images/piece/rainbow_ring.png', FALSE, 8);

-- 拖尾效果：使用预定义颜色
INSERT INTO shop_items (item_type, item_id, name, price, image_path, is_default, sort_order) VALUES
('trail_effect', 'trail_white', '白色', 0, NULL, TRUE, 1),
('trail_effect', 'trail_red', '红色', 50, NULL, FALSE, 2),
('trail_effect', 'trail_blue', '蓝色', 50, NULL, FALSE, 3),
('trail_effect', 'trail_green', '绿色', 50, NULL, FALSE, 4),
('trail_effect', 'trail_gold', '金色', 80, NULL, FALSE, 5),
('trail_effect', 'trail_rainbow', '彩虹', 150, NULL, FALSE, 6),
('trail_effect', 'trail_fire', '火花', 200, NULL, FALSE, 7),
('trail_effect', 'trail_snow', '白色星星', 250, NULL, FALSE, 8),
('trail_effect', 'trail_stars', '黄色星星', 200, NULL, FALSE, 9),
('trail_effect', 'trail_smoke', '烟雾', 300, NULL, FALSE, 10),
('trail_effect', 'trail_lightning', '闪电', 250, NULL, FALSE, 11);
