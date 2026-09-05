/**
 * 新手教程内容数据
 */
const HelpData = [
  {
    id: 'intro',
    title: '游戏简介',
    desc: '了解游戏基本概念',
    content: `
      <h3>游戏简介</h3>
      <p><strong>碰了又碰</strong>是一款双人物理碰撞弹珠游戏。两位玩家各持数枚棋子，通过弹射棋子撞击对手的棋子，将对手全部棋子击出棋盘即可获胜。</p>
      <div style="text-align: center; margin: 20px 0;">
        <img src="assets/images/map.png" alt="游戏界面" style="max-width: 100%; width: 700px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.2);">
      </div>
    `
  },
  {
    id: 'control',
    title: '操作方法',
    desc: '如何选择和发射棋子',
    content: `
      <h3>操作方法</h3>
      <h4>选择棋子</h4>
      <p>鼠标单击<strong>自己的棋子</strong>进行选中，选中后棋子会显示白色边框。</p>
      <h4>发射棋子</h4>
      <ol>
        <li><strong>按住</strong>已选中的棋子（鼠标左键不松开）</li>
        <li><strong>拖拽</strong>鼠标向后方拉动（像拉弹弓一样）</li>
        <li>观察力度条显示的发射力度</li>
        <li><strong>松开</strong>鼠标发射棋子</li>
      </ol>
      <h4>力度控制</h4>
      <ul>
        <li>拖拽距离越远，发射力度越大</li>
        <li>力度条会显示当前力度等级</li>
      </ul>
    `
  },
  {
    id: 'chaos',
    title: '乱斗模式',
    desc: '自由战斗模式',
    content: `
      <h3>乱斗模式</h3>
      <p>乱斗模式是一种自由战斗模式，支持 2-4 名玩家同场竞技。</p>
      <h4>核心规则</h4>
      <ul>
        <li><strong>自由发射</strong>：无需等待回合，任意时刻都可发射棋子</li>
        <li><strong>能量系统</strong>：每次发射消耗 1 点能量，能量随时间自动恢复</li>
        <li><strong>道具系统</strong>：场景中会随机生成各种道具，拾取可获得特殊效果</li>
        <li><strong>地形生成</strong>：每过一段时间会在场景中生成墙壁，增加战斗变数</li>
      </ul>
      <h4>道具一览</h4>
      <table>
        <tr><th>道具</th><th>效果</th></tr>
        <tr><td><span style="color: #2ed573">●</span> 快速恢复</td><td>能量恢复速度加快</td></tr>
        <tr><td><span style="color: #1e90ff">●</span> 冰冻</td><td>冻住所有敌方棋子 5 秒</td></tr>
        <tr><td><span style="color: #ffd700">●</span> 富贵同享</td><td>击落对手棋子时自己复活一颗</td></tr>
        <tr><td><span style="color: #ff4757">●</span> 我命由天</td><td>随机删除一名对手棋子</td></tr>
        <tr><td><span style="color: #a4a4a4">●</span> 隐身</td><td>所有对手棋子隐形 5 秒</td></tr>
        <tr><td><span style="color: #9b59b6">●</span> 浑然一体</td><td>所有棋子变为紫色，持续 6 秒</td></tr>
      </table>
      <h4>胜负条件</h4>
      <p>将对手的<strong>所有棋子</strong>击出棋盘即可获胜。</p>
    `
  },
  {
    id: 'rules',
    title: '特殊规则',
    desc: '保护回合与技能重置',
    content: `
      <h3>特殊规则</h3>
      <h4>保护回合</h4>
      <ul>
        <li>每个玩家的首回合（游戏开始前2回合），所有棋子处于保护状态</li>
        <li>保护状态的棋子被撞击出界后会复活到初始位置</li>
      </ul>
      <h4>技能解锁</h4>
      <ul>
        <li>前4回合不能使用技能</li>
      </ul>
      <h4>技能重置（技能模式）</h4>
      <ul>
        <li>每20回合，所有在场棋子的技能使用次数重置</li>
        <li>特别注意！进行中的技能效果会被清除</li>
      </ul>
      <h4>对局设置</h4>
      <ol>
        <li>联网模式下，在创建房间时，通过齿轮图标设置"地形生成"和"棋子数量"</li>
        <li>本地模式下，在游戏开始前，通过齿轮图标设置"地形生成"</li>
      </ol>
    `
  },
  {
    id: 'network',
    title: '联网对战',
    desc: '与其他玩家在线对战',
    content: `
      <h3>联网对战</h3>
      <h4>进入联网</h4>
      <ul>
        <li>在主菜单点击"联网对战"</li>
        <li>可创建房间或加入现有房间</li>
      </ul>
      <h4>创建房间</h4>
      <ul>
        <li>点击"创建房间"</li>
        <li>选择游戏模式（经典/技能）</li>
        <li>可设置房间名称和棋子数量</li>
      </ul>
      <h4>加入房间</h4>
      <ul>
        <li>输入房间ID加入</li>
        <li>或在房间列表中选择加入</li>
      </ul>
      <h4>匹配流程</h4>
      <ul>
        <li>双方玩家进入房间后选择颜色</li>
        <li>双方都点击"准备"</li>
        <li>游戏自动开始</li>
      </ul>
    `
  },
  {
    id: 'faq',
    title: '常见问题',
    desc: 'FAQ与解答',
    content: `
      <h3>常见问题</h3>
      <h4>Q: 为什么我的棋子无法选中？</h4>
      <p>A: 确保点击的是自己的棋子（界面有A/B标识），且棋子当前不在移动中。</p>
      <h4>Q: 使用闪现技能后如何移动棋子？</h4>
      <p>A: 通过键盘<strong>上下左右键</strong>进行移动。</p>
      <h4>Q: 全局技能为什么用不了？</h4>
      <p>A: 检查是否已经用过；双方的全局技能不能同时生效。</p>
      <h4>Q: 什么时候能用技能？</h4>
      <p>A: 除了分身和超重，其他技能（包括全局技能）只能在自己回合时使用。</p>
      <h4>Q: 分身可以移动吗？</h4>
      <p>A: 分身不能主动移动，但可以被撞击后滑动。</p>
    `
  }
];

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined') {
  window.HelpData = HelpData;
}
