/**
 * Socket客户端
 * 负责与服务器的WebSocket通信
 */
class SocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.eventListeners = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
    }

    /**
     * 注册服务器消息监听器
     */
    registerServerMessageListeners() {
        if (!this.socket) return;
        
        // 监听服务器消息
        this.socket.on(MessageTypes.CONNECT, (data) => {
            this.emit('serverConnect', data);
        });

        this.socket.on(MessageTypes.MATCH_SUCCESS, (data) => {
            this.emit('matchSuccess', data);
        });

        this.socket.on(MessageTypes.ROOM_CREATED, (data) => {
            this.emit('roomCreated', data);
        });

        this.socket.on(MessageTypes.ROOM_JOINED, (data) => {
            this.emit('roomJoined', data);
        });

        this.socket.on(MessageTypes.ROOM_LEAVED, (data) => {
            this.emit('roomLeaved', data);
        });

        this.socket.on(MessageTypes.ROOM_LIST, (data) => {
            this.emit('roomList', data);
        });

        this.socket.on(MessageTypes.PLAYER_JOINED, (data) => {
            this.emit('playerJoined', data);
        });

        this.socket.on(MessageTypes.PLAYER_LEFT, (data) => {
            this.emit('playerLeft', data);
        });

        this.socket.on(MessageTypes.PLAYER_READY, (data) => {
            this.emit('playerReady', data);
        });

        this.socket.on(MessageTypes.GAME_START, (data) => {
            this.emit('gameStart', data);
        });

        this.socket.on(MessageTypes.GAME_STATE, (data) => {
            this.emit('gameState', data);
        });

        this.socket.on(MessageTypes.STATE_SYNC, (data) => {
            this.emit('stateSync', data);
        });

        this.socket.on(MessageTypes.PLAYER_ACTION, (data) => {
            this.emit('playerAction', data);
        });

        this.socket.on(MessageTypes.TURN_CHANGE, (data) => {
            this.emit('turnChange', data);
        });

        // 技能重置通知
        this.socket.on(MessageTypes.SKILL_RESET_NOTIFY, () => {
            this.emit('skillResetNotify');
        });

        // 服务器权威物理相关消息
        this.socket.on(MessageTypes.PIECE_POSITIONS, (data) => {
            this.emit('piece_positions', data);
        });

        // 碰撞事件消息
        this.socket.on(MessageTypes.COLLISION, (data) => {
            this.emit('collision', data);
        });

        // 在线人数消息
        this.socket.on(MessageTypes.ONLINE_PLAYERS, (data) => {
            this.emit('online_players', data);
        });

        this.socket.on(MessageTypes.ANIMATION_START, (data) => {
            this.emit('animation_start', data);
        });

        this.socket.on(MessageTypes.ANIMATION_END, (data) => {
            this.emit('animation_end', data);
        });

        // 重新开始相关消息
        this.socket.on(MessageTypes.RESTART_REQUEST, (data) => {
            this.emit('restart_request', data);
        });

        this.socket.on(MessageTypes.RESTART_ACCEPT, (data) => {
            this.emit('restart_accept', data);
        });

        this.socket.on(MessageTypes.RESTART_REJECT, (data) => {
            this.emit('restart_reject', data);
        });

        this.socket.on(MessageTypes.RESTART_CONFIRM, (data) => {
            this.emit('restart_confirm', data);
        });

        // 游戏结束消息
        this.socket.on(MessageTypes.GAME_END, (data) => {
            this.emit('game_end', data);
        });

        // 联网经典模式相关消息
        this.socket.on(MessageTypes.NETWORK_CLASSIC_PREPARE, (data) => {
            this.emit('network_classic_prepare', data);
        });

        this.socket.on(MessageTypes.NETWORK_CLASSIC_START, (data) => {
            this.emit('network_classic_start', data);
        });

        // 联网技能模式相关消息
        this.socket.on(MessageTypes.NETWORK_SKILL_PREPARE, (data) => {
            this.emit('network_skill_prepare', data);
        });

        this.socket.on(MessageTypes.NETWORK_SKILL_TURN, (data) => {
            this.emit('network_skill_turn', data);
        });

        this.socket.on(MessageTypes.NETWORK_SKILL_SELECTED, (data) => {
            this.emit('network_skill_selected', data);
        });

        this.socket.on(MessageTypes.NETWORK_SKILL_GLOBAL_SELECTED, (data) => {
            this.emit('network_skill_global_selected', data);
        });

        this.socket.on(MessageTypes.NETWORK_SKILL_START, (data) => {
            this.emit('network_skill_start', data);
        });

        // 房间更新消息
        this.socket.on(MessageTypes.ROOM_UPDATE, (data) => {
            this.emit('roomUpdate', data);
        });

        // 聊天消息
        this.socket.on(MessageTypes.CHAT_MESSAGE, (data) => {
            this.emit('chat_message', data);
        });

        // 表情消息
        this.socket.on(MessageTypes.EMOJI, (data) => {
            this.emit('emoji', data);
        });

        // 错误消息
        this.socket.on(MessageTypes.ERROR, (data) => {
            this.emit('error', data);
        });

        // 房主返回大厅消息
        this.socket.on(MessageTypes.HOST_LEFT, (data) => {
            this.emit('hostLeft', data);
        });

        // 道具相关消息
        this.socket.on(MessageTypes.ITEM_SPAWNED, (data) => {
            this.emit('item_spawned', data);
        });

        this.socket.on(MessageTypes.ITEM_PICKED_UP, (data) => {
            this.emit('item_picked_up', data);
        });

        this.socket.on(MessageTypes.ITEM_DESPAWNED, (data) => {
            this.emit('item_despawned', data);
        });

        // 棋子状态相关消息
        this.socket.on(MessageTypes.PIECE_FROZEN, (data) => {
            this.emit('piece_frozen', data);
        });

        this.socket.on(MessageTypes.PIECE_DELETED, (data) => {
            this.emit('piece_deleted', data);
        });
    }

    /**
     * 连接到服务器
     * @param {string} url - 服务器地址
     * @returns {Promise} 连接结果
     */
    connect(url = '') {
        // 如果没有提供url，使用当前页面的地址
        if (!url) {
            // 构建当前页面的基础URL（移除路径和查询参数）
            const protocol = window.location.protocol;
            const host = window.location.host;
            url = `${protocol}//${host}`;
        }
        
        return new Promise((resolve, reject) => {
            try {
                // 从 networkManager 获取 token
                const token = window.networkManager ? window.networkManager.getAuthToken() : null;

                this.socket = io(url, {
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: this.reconnectDelay,
                    auth: token ? { token } : {}
                });

                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    // 注册服务器消息监听器
                    this.registerServerMessageListeners();
                    this.emit('connected');
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    this.emit('disconnected');
                });

                this.socket.on('error', (error) => {
                    this.emit('error', error);
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    /**
     * 发送消息到服务器
     * @param {string} type - 消息类型
     * @param {object} data - 消息数据
     */
    send(type, data) {
        if (this.isConnected && this.socket) {
            this.socket.emit(type, data);
        }
    }

    /**
     * 注册事件监听器
     * @param {string} event - 事件名称
     * @param {function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {function} callback - 回调函数
     */
    off(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('事件回调错误:', error);
                }
            });
        }
    }

    /**
     * 检查连接状态
     * @returns {boolean} 是否连接
     */
    getConnected() {
        return this.isConnected;
    }
}

// 导出单例实例
const socketClient = new SocketClient();

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
    window.socketClient = socketClient;
}
