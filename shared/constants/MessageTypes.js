/**
 * 网络消息类型定义
 * 客户端和服务端共用
 */

const MessageTypes = {
    // 连接相关
    CONNECT: 'server_connect',
    DISCONNECT: 'server_disconnect',
    RECONNECT: 'server_reconnect',
    CONNECT_ERROR: 'server_connect_error',
    ONLINE_PLAYERS: 'online_players',
    
    // 匹配相关
    JOIN_LOBBY: 'join_lobby',
    LEAVE_LOBBY: 'leave_lobby',
    MATCH_REQUEST: 'match_request',
    MATCH_SUCCESS: 'match_success',
    MATCH_CANCEL: 'match_cancel',
    
    // 房间相关
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    ROOM_CREATED: 'room_created',
    ROOM_JOINED: 'room_joined',
    ROOM_LEAVED: 'room_leaved',
    ROOM_LIST: 'room_list',
    ROOM_UPDATE: 'room_update',
    UPDATE_ROOM_PIECE_COUNT: 'update_room_piece_count',
    SWITCH_POSITION: 'switch_position',
    
    // 游戏相关
    GAME_START: 'game_start',
    GAME_STATE: 'game_state',
    GAME_END: 'game_end',
    GAME_ERROR: 'game_error',
    
    // 玩家操作
    PLAYER_ACTION: 'player_action',
    PLAYER_READY: 'player_ready',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    PLAYER_SURRENDER: 'player_surrender',
    
    // 回合相关
    TURN_CHANGE: 'turn_change',
    TURN_CHANGE_REQUEST: 'turn_change_request',
    TURN_START: 'turn_start',
    TURN_END: 'turn_end',

    // 物理同步（服务器权威）
    PIECE_POSITIONS: 'piece_positions',  // 广播棋子位置更新
    ANIMATION_START: 'animation_start',  // 动画开始
    ANIMATION_END: 'animation_end',  // 动画结束（所有棋子停止）
    COLLISION: 'collision',  // 碰撞事件（用于播放碰撞音效）
    
    // 技能相关
    SKILL_USE: 'skill_use',
    SKILL_EFFECT: 'skill_effect',
    SKILL_PLACE_CLONE: 'skill_place_clone',
    SKILL_MOVE_BLINK: 'skill_move_blink',
    SKILL_RESET_NOTIFY: 'skill_reset_notify',
    
    // 棋子操作
    PIECE_SELECT: 'piece_select',
    PIECE_DRAG: 'piece_drag',
    PIECE_RELEASE: 'piece_release',
    
    // 同步相关
    STATE_SYNC: 'state_sync',
    STATE_REQUEST: 'state_request',
    PING: 'ping',
    PONG: 'pong',
    
    // 聊天相关
    CHAT_MESSAGE: 'chat_message',
    EMOJI: 'emoji',
    
    // 错误相关
    ERROR: 'error',
    INVALID_ACTION: 'invalid_action',
    NOT_YOUR_TURN: 'not_your_turn',
    
    // 重新开始相关
    RESTART_REQUEST: 'restart_request',
    RESTART_ACCEPT: 'restart_accept',
    RESTART_REJECT: 'restart_reject',
    RESTART_CONFIRM: 'restart_confirm',
    
    // 联网经典模式准备相关
    NETWORK_CLASSIC_PREPARE: 'network_classic_prepare',
    NETWORK_CLASSIC_CONFIRM: 'network_classic_confirm',
    NETWORK_CLASSIC_READY: 'network_classic_ready',
    NETWORK_CLASSIC_START: 'network_classic_start',

    // 联网技能模式准备相关
    NETWORK_SKILL_PREPARE: 'network_skill_prepare',
    NETWORK_SKILL_TURN: 'network_skill_turn',
    NETWORK_SKILL_SELECT: 'network_skill_select',
    NETWORK_SKILL_SELECTED: 'network_skill_selected',
    NETWORK_SKILL_GLOBAL_SELECT: 'network_skill_global_select',
    NETWORK_SKILL_GLOBAL_SELECTED: 'network_skill_global_selected',
    NETWORK_SKILL_CONFIRM: 'network_skill_confirm',
    NETWORK_SKILL_START: 'network_skill_start',
    
    // 返回房间相关
    BACK_TO_ROOM: 'back_to_room',
    
    // 返回大厅相关
    BACK_TO_LOBBY: 'back_to_lobby',
    HOST_LEFT: 'host_left',

    // 道具相关
    ITEM_SPAWNED: 'item_spawned',
    ITEM_PICKED_UP: 'item_picked_up',
    ITEM_EFFECT_START: 'item_effect_start',
    ITEM_EFFECT_END: 'item_effect_end',
    ITEM_DESPAWNED: 'item_despawned',
    PIECE_FROZEN: 'piece_frozen',
    PIECE_DELETED: 'piece_deleted'
};

// 支持CommonJS和ES6模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageTypes;
}