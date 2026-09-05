class Menu {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.eventManager = new EventManager();
    }

    show() {
        this.container.style.display = 'flex';
    }

    hide() {
        this.container.style.display = 'none';
    }

    onModeSelect(callback) {
        this.eventManager.on('modeSelect', callback);
    }

    triggerModeSelect(mode) {
        this.eventManager.emit('modeSelect', mode);
    }
}

class GameUI {
    constructor() {
        this.gameContainer = document.getElementById('gameContainer');
        this.player1Info = document.getElementById('player1Info');
        this.player2Info = document.getElementById('player2Info');
        this.player1Count = document.getElementById('player1Count');
        this.player2Count = document.getElementById('player2Count');
    }

    show() {
        this.gameContainer.style.display = 'flex';
    }

    hide() {
        this.gameContainer.style.display = 'none';
    }

    updatePlayerStatus(currentPlayer, player1Count, player2Count) {
        this.player1Info.classList.toggle('active', currentPlayer === 1);
        this.player2Info.classList.toggle('active', currentPlayer === 2);
        this.player1Count.textContent = player1Count;
        this.player2Count.textContent = player2Count;
    }

    updatePlayerColors(player1Color, player2Color) {
        const player1ColorEl = this.player1Info.querySelector('.player-color');
        const player2ColorEl = this.player2Info.querySelector('.player-color');
        if (player1ColorEl) {
            player1ColorEl.style.backgroundColor = player1Color;
            player1ColorEl.style.boxShadow = `0 0 10px ${player1Color}`;
        }
        if (player2ColorEl) {
            player2ColorEl.style.backgroundColor = player2Color;
            player2ColorEl.style.boxShadow = `0 0 10px ${player2Color}`;
        }
    }
}

class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.eventManager = new EventManager();
    }

    show() {
        this.modal.classList.add('show');
    }

    hide() {
        this.modal.classList.remove('show');
    }

    setContent(content) {
        const contentElement = this.modal.querySelector('.winner-content');
        if (contentElement) {
            contentElement.innerHTML = content;
        }
    }

    setText(text) {
        const textElement = this.modal.querySelector('#winnerText');
        if (textElement) {
            textElement.textContent = text;
        }
    }

    onRestart(callback) {
        this.eventManager.on('restart', callback);
    }

    onBackToMenu(callback) {
        this.eventManager.on('backToMenu', callback);
    }

    triggerRestart() {
        this.eventManager.emit('restart');
    }

    triggerBackToMenu() {
        this.eventManager.emit('backToMenu');
    }
}