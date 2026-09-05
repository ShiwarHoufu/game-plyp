class SkillSelectionUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.eventManager = new EventManager();
        this.currentPlayer = 1;
        this.selectedSkills = { 1: [], 2: [] };
        this.selectedGlobalSkills = { 1: null, 2: null };
        this.maxSkillsPerPlayer = 3;
        // 网络模式相关
        this.isNetworkMode = false;
        this.networkPhase = 'skill'; // 'skill' | 'global' | 'confirm'
        this.selectionEnabled = true;
        // 从 GameConfig 读取技能配置
        this.availableSkills = [
            GAME_CONFIG.skills.frenzy,
            GAME_CONFIG.skills.doubleStrike,
            GAME_CONFIG.skills.blink,
            GAME_CONFIG.skills.clone,
            GAME_CONFIG.skills.heavy,
            GAME_CONFIG.skills.intangible
        ];
        this.availableGlobalSkills = [
            GAME_CONFIG.globalSkills.weakness,
            GAME_CONFIG.globalSkills.shrink
        ];
        this.initUI();
    }

    setMaxSkillsPerPlayer(count) {
        this.maxSkillsPerPlayer = count;
        this.reset();
    }

    initUI() {
        this.generateTerrain = false;
        this.container.innerHTML = `
            <div class="skill-selection-content">
                <div class="skill-selection-header">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <h1 class="preparation-title">准备阶段</h1>
                        <button class="settings-btn" id="settingsBtn">⚙️</button>
                    </div>
                    <div class="current-player-indicator">
                        <div class="player-badge" id="currentPlayerBadge">玩家A</div>
                        <p>请选择技能棋子</p>
                    </div>
                </div>

                <div class="skills-display-area">
                    <div class="available-skills">
                        <h3>可选择的技能棋子</h3>
                        <div class="skills-grid" id="skillsGrid"></div>
                    </div>
                </div>

                <div class="selected-skills-area">
                    <div class="player-selected-skills" id="player1SkillsArea">
                        <h3>玩家A 已选技能</h3>
                        <div class="selected-skills-grid" id="player1Selected"></div>
                    </div>
                    <div class="player-selected-skills" id="player2SkillsArea">
                        <h3>玩家B 已选技能</h3>
                        <div class="selected-skills-grid" id="player2Selected"></div>
                    </div>
                </div>

                <div class="global-skills-area">
                    <h3>全局技能选择</h3>
                    <div class="global-skills-grid" id="globalSkillsGrid"></div>
                    <div class="selected-global-skills">
                        <div class="player-global-skill" id="player1GlobalSkill">
                            <h4>玩家A 全局技能</h4>
                            <div class="global-skill-display" id="player1GlobalSkillDisplay"></div>
                        </div>
                        <div class="player-global-skill" id="player2GlobalSkill">
                            <h4>玩家B 全局技能</h4>
                            <div class="global-skill-display" id="player2GlobalSkillDisplay"></div>
                        </div>
                    </div>
                </div>

                <div class="skill-selection-footer">
                    <button class="start-battle-btn" id="startBattleBtn" disabled>开始对决！</button>
                    <button class="back-to-menu-btn" id="backToMenuBtn">返回菜单</button>
                </div>
        `;

        this.renderAvailableSkills();
        this.renderGlobalSkills();
        this.bindEvents();
    }

    renderAvailableSkills() {
        const skillsGrid = document.getElementById('skillsGrid');
        skillsGrid.innerHTML = '';

        this.availableSkills.forEach(skill => {
            const skillCard = document.createElement('div');
            skillCard.className = 'skill-card';
            skillCard.dataset.skillId = skill.id;
            skillCard.innerHTML = `
                <div class="skill-icon" style="background-color: ${skill.color}"></div>
                <div class="skill-name">${skill.name}</div>
                <div class="skill-description">${skill.description}</div>
            `;
            skillsGrid.appendChild(skillCard);
        });
    }

    renderGlobalSkills() {
        const globalSkillsGrid = document.getElementById('globalSkillsGrid');
        globalSkillsGrid.innerHTML = '';

        this.availableGlobalSkills.forEach(skill => {
            const skillCard = document.createElement('div');
            skillCard.className = 'global-skill-card';
            skillCard.dataset.skillId = skill.id;
            skillCard.innerHTML = `
                <div class="global-skill-icon" style="background-color: ${skill.color}">
                    <div class="global-skill-symbol">${skill.name.charAt(0)}</div>
                </div>
                <div class="skill-name">${skill.name}</div>
                <div class="skill-description">${skill.description}</div>
            `;
            globalSkillsGrid.appendChild(skillCard);
        });
    }

    updateSelectedSkillsDisplay() {
        const player1Container = document.getElementById('player1Selected');
        const player2Container = document.getElementById('player2Selected');

        player1Container.innerHTML = '';
        player2Container.innerHTML = '';

        this.selectedSkills[1].forEach(skill => {
            const skillCard = document.createElement('div');
            skillCard.className = 'selected-skill-card';
            skillCard.innerHTML = `
                <div class="skill-icon" style="background-color: ${skill.color}"></div>
                <div class="skill-name">${skill.name}</div>
            `;
            player1Container.appendChild(skillCard);
        });

        this.selectedSkills[2].forEach(skill => {
            const skillCard = document.createElement('div');
            skillCard.className = 'selected-skill-card';
            skillCard.innerHTML = `
                <div class="skill-icon" style="background-color: ${skill.color}"></div>
                <div class="skill-name">${skill.name}</div>
            `;
            player2Container.appendChild(skillCard);
        });

        this.updateSelectedGlobalSkillsDisplay();
    }

    updateSelectedGlobalSkillsDisplay() {
        const player1GlobalSkillDisplay = document.getElementById('player1GlobalSkillDisplay');
        const player2GlobalSkillDisplay = document.getElementById('player2GlobalSkillDisplay');

        player1GlobalSkillDisplay.innerHTML = '';
        player2GlobalSkillDisplay.innerHTML = '';

        if (this.selectedGlobalSkills[1]) {
            const skill = this.selectedGlobalSkills[1];
            const skillCard = document.createElement('div');
            skillCard.className = 'selected-global-skill-card';
            skillCard.innerHTML = `
                <div class="global-skill-icon" style="background-color: ${skill.color}">
                    <div class="global-skill-symbol">${skill.name.charAt(0)}</div>
                </div>
                <div class="skill-name">${skill.name}</div>
            `;
            player1GlobalSkillDisplay.appendChild(skillCard);
        }

        if (this.selectedGlobalSkills[2]) {
            const skill = this.selectedGlobalSkills[2];
            const skillCard = document.createElement('div');
            skillCard.className = 'selected-global-skill-card';
            skillCard.innerHTML = `
                <div class="global-skill-icon" style="background-color: ${skill.color}">
                    <div class="global-skill-symbol">${skill.name.charAt(0)}</div>
                </div>
                <div class="skill-name">${skill.name}</div>
            `;
            player2GlobalSkillDisplay.appendChild(skillCard);
        }

        const startBtn = document.getElementById('startBattleBtn');
        startBtn.disabled = !(this.selectedSkills[1].length === this.maxSkillsPerPlayer && this.selectedSkills[2].length === this.maxSkillsPerPlayer && 
                            this.selectedGlobalSkills[1] && this.selectedGlobalSkills[2]);
    }

    bindEvents() {
        const skillsGrid = document.getElementById('skillsGrid');
        const globalSkillsGrid = document.getElementById('globalSkillsGrid');
        const startBtn = document.getElementById('startBattleBtn');
        const backBtn = document.getElementById('backToMenuBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        skillsGrid.addEventListener('click', (e) => {
            const skillCard = e.target.closest('.skill-card');
            if (skillCard) {
                const skillId = skillCard.dataset.skillId;
                this.selectSkill(skillId);
            }
        });

        globalSkillsGrid.addEventListener('click', (e) => {
            const skillCard = e.target.closest('.global-skill-card');
            if (skillCard) {
                const skillId = skillCard.dataset.skillId;
                this.selectGlobalSkill(skillId);
            }
        });

        startBtn.addEventListener('click', () => {
            if (this.isNetworkMode) {
                // 网络模式：发送确认消息
                if (window.networkManager) {
                    networkManager.sendSkillConfirm();
                }
            } else {
                // 本地模式：发射开始战斗事件
                this.eventManager.emit('startBattle', {
                    player1Skills: this.selectedSkills[1],
                    player2Skills: this.selectedSkills[2],
                    player1GlobalSkill: this.selectedGlobalSkills[1],
                    player2GlobalSkill: this.selectedGlobalSkills[2],
                    generateTerrain: this.generateTerrain
                });
            }
        });

        backBtn.addEventListener('click', () => {
            if (this.isNetworkMode) {
                // 网络模式：显示确认弹窗
                const confirmModal = document.getElementById('confirmModal');
                if (confirmModal) {
                    confirmModal.classList.add('show');
                }
            } else {
                // 本地模式：直接返回菜单
                this.eventManager.emit('backToMenu');
            }
        });

        settingsBtn.addEventListener('click', () => {
            const settingsModal = document.getElementById('settingsModal');
            const terrainToggle = document.getElementById('terrainToggle');
            terrainToggle.checked = this.generateTerrain;
            settingsModal.classList.add('show');
        });
    }

    selectSkill(skillId) {
        // 检查选择是否可用
        if (this.isNetworkMode && !this.selectionEnabled) {
            this.showTemporaryMessage('等待对方选择...');
            return;
        }

        const currentSelected = this.selectedSkills[this.currentPlayer];

        if (currentSelected.length >= this.maxSkillsPerPlayer) {
            return;
        }

        const skill = this.availableSkills.find(s => s.id === skillId);

        if (skill && !currentSelected.find(s => s.id === skillId)) {
            if (this.isNetworkMode) {
                // 网络模式：发送选择到服务器
                if (window.networkManager) {
                    networkManager.sendSkillSelect(skillId);
                }
            } else {
                // 本地模式：直接更新
                currentSelected.push(skill);
                this.updateSelectedSkillsDisplay();

                // 检查是否所有普通技能都已选择完成
                const allSkillsSelected = this.selectedSkills[1].length === this.maxSkillsPerPlayer && this.selectedSkills[2].length === this.maxSkillsPerPlayer;

                if (allSkillsSelected) {
                    // 所有普通技能选择完成，切换到全局技能选择
                    this.currentPlayer = 1; // 确保玩家A先选
                    this.updateCurrentPlayerDisplay();
                    this.showTemporaryMessage('请选择全局技能！');
                } else {
                    // 每选择一个技能后，切换到另一个玩家
                    if (this.currentPlayer === 1) {
                        // 检查玩家B是否已经选满3个
                        if (this.selectedSkills[2].length < this.maxSkillsPerPlayer) {
                            this.currentPlayer = 2;
                            this.updateCurrentPlayerDisplay();
                        }
                    } else {
                        // 检查玩家A是否已经选满3个
                        if (this.selectedSkills[1].length < this.maxSkillsPerPlayer) {
                            this.currentPlayer = 1;
                            this.updateCurrentPlayerDisplay();
                        }
                    }
                }
            }
        } else if (skill) {
            // 已经选择了这个技能，显示提示
            this.showTemporaryMessage('不能选择重复的技能！');
        }
    }

    selectGlobalSkill(skillId) {
        // 检查选择是否可用
        if (this.isNetworkMode && !this.selectionEnabled) {
            this.showTemporaryMessage('等待对方选择...');
            return;
        }

        // 只有在两个玩家都选择完普通技能后才能选择全局技能
        if (this.selectedSkills[1].length !== this.maxSkillsPerPlayer || this.selectedSkills[2].length !== this.maxSkillsPerPlayer) {
            this.showTemporaryMessage('请先选择完所有普通技能后再选择全局技能！');
            return;
        }

        // 检查是否已经选择完所有全局技能
        const allGlobalSkillsSelected = this.selectedGlobalSkills[1] && this.selectedGlobalSkills[2];
        if (allGlobalSkillsSelected) {
            this.showTemporaryMessage('全局技能已选择完成，不能再修改！');
            return;
        }

        // 确保先让玩家A选择全局技能
        if (!this.selectedGlobalSkills[1]) {
            this.currentPlayer = 1;
            this.updateCurrentPlayerDisplay();
        } else if (!this.selectedGlobalSkills[2]) {
            this.currentPlayer = 2;
            this.updateCurrentPlayerDisplay();
        }

        const skill = this.availableGlobalSkills.find(s => s.id === skillId);

        if (skill) {
            if (this.isNetworkMode) {
                // 网络模式：发送选择到服务器
                if (window.networkManager) {
                    networkManager.sendGlobalSkillSelect(skillId);
                }
            } else {
                // 本地模式：直接更新
                this.selectedGlobalSkills[this.currentPlayer] = skill;
                this.updateSelectedGlobalSkillsDisplay();

                // 检查是否所有全局技能都已选择完成
                const allGlobalSkillsSelectedNow = this.selectedGlobalSkills[1] && this.selectedGlobalSkills[2];

                if (allGlobalSkillsSelectedNow) {
                    // 所有全局技能选择完成，隐藏高亮状态
                    this.updateCurrentPlayerDisplay();
                } else {
                    // 切换到另一个玩家
                    if (this.currentPlayer === 1) {
                        this.currentPlayer = 2;
                        this.updateCurrentPlayerDisplay();
                    } else {
                        this.currentPlayer = 1;
                        this.updateCurrentPlayerDisplay();
                    }
                }
            }
        }
    }

    onStartBattle(callback) {
        this.eventManager.on('startBattle', callback);
    }

    onBackToMenu(callback) {
        this.eventManager.on('backToMenu', callback);
    }

    show() {
        this.container.style.display = 'flex';
        this.isNetworkMode = false;  // 确保本地模式
        this.reset();
        // 显示齿轮按钮（本地模式需要）
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.style.display = 'block';
        }
    }

    hide() {
        this.container.style.display = 'none';
    }

    reset() {
        this.currentPlayer = 1;
        this.selectedSkills = { 1: [], 2: [] };
        this.selectedGlobalSkills = { 1: null, 2: null };
        this.networkPhase = 'skill';
        this.selectionEnabled = true;
        this.updateCurrentPlayerDisplay();
        this.updateSelectedSkillsDisplay();
    }

    /**
     * 重置为网络模式（保留网络模式状态）
     */
    resetForNetwork() {
        this.currentPlayer = 1;
        this.selectedSkills = { 1: [], 2: [] };
        this.selectedGlobalSkills = { 1: null, 2: null };
        this.selectionEnabled = true;
        this.updateCurrentPlayerDisplay();
        this.updateSelectedSkillsDisplay();
    }

    /**
     * 设置选择是否可用（网络模式用）
     * @param {boolean} enabled - 是否可用
     */
    setSelectionEnabled(enabled) {
        this.selectionEnabled = enabled;
        const skillsGrid = document.getElementById('skillsGrid');
        const globalSkillsGrid = document.getElementById('globalSkillsGrid');

        if (skillsGrid) {
            skillsGrid.style.pointerEvents = enabled ? 'auto' : 'none';
            skillsGrid.style.opacity = enabled ? '1' : '0.5';
        }
        if (globalSkillsGrid) {
            globalSkillsGrid.style.pointerEvents = enabled ? 'auto' : 'none';
            globalSkillsGrid.style.opacity = enabled ? '1' : '0.5';
        }
    }

    /**
     * 设置网络模式阶段
     * @param {string} phase - 'skill' | 'global' | 'confirm'
     */
    setNetworkPhase(phase) {
        this.networkPhase = phase;
        this.updateStartButton();
    }

    /**
     * 更新开始按钮状态
     */
    updateStartButton() {
        const startBtn = document.getElementById('startBattleBtn');
        if (!startBtn) return;

        if (this.isNetworkMode) {
            // 网络模式下，所有阶段都隐藏按钮，游戏会自动开始
            startBtn.style.display = 'none';
        } else {
            // 本地模式
            startBtn.style.display = 'block';
            startBtn.disabled = !(this.selectedSkills[1].length === this.maxSkillsPerPlayer &&
                                  this.selectedSkills[2].length === this.maxSkillsPerPlayer &&
                                  this.selectedGlobalSkills[1] && this.selectedGlobalSkills[2]);
            startBtn.textContent = '开始对决！';
        }
    }

    /**
     * 更新确认状态显示（网络模式用）
     * @param {boolean} player1Confirmed - 玩家1是否已确认
     * @param {boolean} player2Confirmed - 玩家2是否已确认
     */
    updateConfirmStatus(player1Confirmed, player2Confirmed) {
        const startBtn = document.getElementById('startBattleBtn');
        if (startBtn && this.isNetworkMode) {
            // 网络模式下隐藏按钮，游戏会自动开始
            startBtn.style.display = 'none';
        }
    }

    /**
     * 从网络更新技能选择显示
     * @param {Array} player1Skills - 玩家1已选技能ID数组
     * @param {Array} player2Skills - 玩家2已选技能ID数组
     */
    updateSelectedSkillsFromNetwork(player1Skills, player2Skills) {
        // 转换技能ID为技能对象
        this.selectedSkills[1] = player1Skills.map(id => {
            return this.availableSkills.find(s => s.id === id) ||
                   { id: id, name: id, color: GAME_CONFIG.skills[id]?.color || '#ffffff' };
        });
        this.selectedSkills[2] = player2Skills.map(id => {
            return this.availableSkills.find(s => s.id === id) ||
                   { id: id, name: id, color: GAME_CONFIG.skills[id]?.color || '#ffffff' };
        });
        this.updateSelectedSkillsDisplay();
    }

    /**
     * 从网络更新全局技能显示
     * @param {string} player1GlobalSkill - 玩家1全局技能ID
     * @param {string} player2GlobalSkill - 玩家2全局技能ID
     * @param {number} currentSelectingPlayer - 当前选择的玩家（0表示选择完成）
     */
    updateGlobalSkillsFromNetwork(player1GlobalSkill, player2GlobalSkill, currentSelectingPlayer) {
        if (player1GlobalSkill) {
            this.selectedGlobalSkills[1] = this.availableGlobalSkills.find(s => s.id === player1GlobalSkill) ||
                                           { id: player1GlobalSkill, name: player1GlobalSkill, color: GAME_CONFIG.globalSkills[player1GlobalSkill]?.color || '#ffd000ff' };
        }
        if (player2GlobalSkill) {
            this.selectedGlobalSkills[2] = this.availableGlobalSkills.find(s => s.id === player2GlobalSkill) ||
                                           { id: player2GlobalSkill, name: player2GlobalSkill, color: GAME_CONFIG.globalSkills[player2GlobalSkill]?.color || '#87CEFA' };
        }
        this.updateSelectedGlobalSkillsDisplay();

        // 如果 currentSelectingPlayer > 0，更新当前选择玩家显示
        if (currentSelectingPlayer > 0) {
            this.currentPlayer = currentSelectingPlayer;
            this.updateCurrentPlayerDisplay();
        }
    }

    /**
     * 设置当前选择玩家（网络模式用）
     * @param {number} player - 玩家ID
     */
    setCurrentPlayer(player) {
        this.currentPlayer = player;
        this.updateCurrentPlayerDisplay();
    }

    updateCurrentPlayerDisplay() {
        const badge = document.getElementById('currentPlayerBadge');
        let playerText;
        let playerClass;

        // 在网络模式下，根据本地玩家ID显示不同的文本
        if (this.isNetworkMode && window.networkManager) {
            const localPlayerId = window.networkManager.playerId;
            const isMyTurn = this.currentPlayer === localPlayerId;
            playerText = isMyTurn ? '轮到你选择' : '轮到对方选择';
            playerClass = isMyTurn ? 'player-a' : 'player-b';
        } else {
            playerText = this.currentPlayer === 1 ? '玩家A' : '玩家B';
            playerClass = this.currentPlayer === 1 ? 'player-a' : 'player-b';
        }

        badge.textContent = playerText;
        badge.className = 'player-badge ' + playerClass;

        // 检查是否已经选择完所有普通技能
        const allSkillsSelected = this.selectedSkills[1].length === this.maxSkillsPerPlayer && this.selectedSkills[2].length === this.maxSkillsPerPlayer;
        // 检查是否已经选择完所有全局技能
        const allGlobalSkillsSelected = this.selectedGlobalSkills[1] && this.selectedGlobalSkills[2];
        
        // 隐藏所有高亮状态
        const player1Area = document.getElementById('player1SkillsArea');
        const player2Area = document.getElementById('player2SkillsArea');
        const player1GlobalSkill = document.getElementById('player1GlobalSkill');
        const player2GlobalSkill = document.getElementById('player2GlobalSkill');
        
        player1Area.classList.remove('active');
        player2Area.classList.remove('active');
        player1GlobalSkill.classList.remove('active');
        player2GlobalSkill.classList.remove('active');
        
        if (allSkillsSelected && !allGlobalSkillsSelected) {
            // 显示全局技能选择区域的高亮状态
            if (this.currentPlayer === 1) {
                player1GlobalSkill.classList.add('active');
            } else {
                player2GlobalSkill.classList.add('active');
            }
        } else if (!allSkillsSelected) {
            // 显示普通技能选择区域的高亮状态
            if (this.currentPlayer === 1) {
                player1Area.classList.add('active');
            } else {
                player2Area.classList.add('active');
            }
        }
    }

    showTemporaryMessage(message) {
        const existingMessage = document.querySelector('.temporary-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'temporary-message';
        messageDiv.textContent = message;
        this.container.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 2000);
    }

    getSelectedSkills() {
        return {
            player1Skills: this.selectedSkills[1],
            player2Skills: this.selectedSkills[2],
            player1GlobalSkill: this.selectedGlobalSkills[1],
            player2GlobalSkill: this.selectedGlobalSkills[2]
        };
    }
}