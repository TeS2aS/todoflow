'use strict';

(() => {
  const AVATARS = [
    '😀', '😎', '🤠', '🥳', '🤖',
    '👻', '🧠', '🔥', '🍕', '🚀',
    '🎲', '🎯', '🏆', '⚡', '🌈',
    '🦄', '🐙', '🧃', '🕺', '💡'
  ];
  const staticPreviewPorts = new Set(['3000', '5173', '5500']);
  const runtimeConfig = window.TODOFLOW_CONFIG || {};
  const recentRoomsKey = 'partyflowRecentRooms';
  const pollDelay = 2600;

  const elements = {
    todoSection: document.querySelector('#todoSection'),
    partySection: document.querySelector('#partySection'),
    modeTabs: [...document.querySelectorAll('[data-party-view]')],
    createRoomForm: document.querySelector('#createRoomForm'),
    joinRoomForm: document.querySelector('#joinRoomForm'),
    roomNameInput: document.querySelector('#roomNameInput'),
    partyNicknameInput: document.querySelector('#partyNicknameInput'),
    partyAvatarSelect: document.querySelector('#partyAvatarSelect'),
    joinNicknameInput: document.querySelector('#joinNicknameInput'),
    joinAvatarSelect: document.querySelector('#joinAvatarSelect'),
    maxPlayersInput: document.querySelector('#maxPlayersInput'),
    roundDurationSelect: document.querySelector('#roundDurationSelect'),
    chaosModeInput: document.querySelector('#chaosModeInput'),
    roomCodeInput: document.querySelector('#roomCodeInput'),
    recentRoomsList: document.querySelector('#recentRoomsList'),
    refreshRoomButton: document.querySelector('#refreshRoomButton'),
    partyRoomPanel: document.querySelector('#partyRoomPanel'),
    activeRoomName: document.querySelector('#activeRoomName'),
    activeRoomCode: document.querySelector('#activeRoomCode'),
    copyRoomCodeButton: document.querySelector('#copyRoomCodeButton'),
    playerList: document.querySelector('#playerList'),
    readyButton: document.querySelector('#readyButton'),
    startSpeedTodoButton: document.querySelector('#startSpeedTodoButton'),
    leaveRoomButton: document.querySelector('#leaveRoomButton'),
    gameTitle: document.querySelector('#gameTitle'),
    gameTimer: document.querySelector('#gameTimer'),
    gameRules: document.querySelector('#gameRules'),
    speedTodoForm: document.querySelector('#speedTodoForm'),
    speedTodoInput: document.querySelector('#speedTodoInput'),
    voteBoard: document.querySelector('#voteBoard'),
    resultBoard: document.querySelector('#resultBoard'),
    endRoundButton: document.querySelector('#endRoundButton'),
    backToLobbyButton: document.querySelector('#backToLobbyButton'),
    roomMessages: document.querySelector('#roomMessages'),
    roomMessageForm: document.querySelector('#roomMessageForm'),
    roomMessageInput: document.querySelector('#roomMessageInput'),
    partyStatus: document.querySelector('#partyStatus'),
    toastRoot: document.querySelector('#toastRoot')
  };

  if (!elements.partySection) {
    return;
  }

  const state = {
    roomState: null,
    pollTimer: 0,
    submitting: false
  };

  function normalizeApiBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function getDefaultApiBaseUrl() {
    if (window.location.protocol === 'file:' || staticPreviewPorts.has(window.location.port)) {
      return 'http://localhost:5000';
    }

    return '';
  }

  const API_BASE_URL = normalizeApiBaseUrl(
    runtimeConfig.API_URL || runtimeConfig.API_BASE_URL || getDefaultApiBaseUrl()
  );

  function buildApiUrl(path) {
    const safePath = path.startsWith('/') ? path : `/${path}`;
    return API_BASE_URL ? `${API_BASE_URL}${safePath}` : safePath;
  }

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setStatus(message, type = '') {
    elements.partyStatus.textContent = message;
    elements.partyStatus.className = `status ${type}`.trim();
  }

  function showToast(message, type = '') {
    if (!elements.toastRoot) {
      setStatus(message, type);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.textContent = message;
    elements.toastRoot.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3400);
  }

  function getStoredSession() {
    return {
      accessToken: localStorage.getItem('todoflowAccessToken') || localStorage.getItem('todoToken') || '',
      refreshToken: localStorage.getItem('todoflowRefreshToken') || ''
    };
  }

  async function refreshSession() {
    const { refreshToken } = getStoredSession();

    if (!refreshToken) {
      throw new Error('Session expiree. Reconnecte-toi avant de relancer le chaos.');
    }

    const response = await fetch(buildApiUrl('/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'Session expiree.');
    }

    localStorage.setItem('todoflowAccessToken', payload.accessToken || payload.token || '');
    localStorage.setItem('todoflowRefreshToken', payload.refreshToken || refreshToken);
    localStorage.setItem('todoflowUser', JSON.stringify(payload.user));
    return payload.accessToken || payload.token || '';
  }

  async function partyFetch(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    const { accessToken } = getStoredSession();

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    let response;

    try {
      response = await fetch(buildApiUrl(path), {
        ...options,
        headers
      });
    } catch (error) {
      throw new Error('Reseau indisponible. Le serveur a demande une pause dramatique.');
    }

    if (response.status === 401 && retry) {
      const nextToken = await refreshSession();
      headers.set('Authorization', `Bearer ${nextToken}`);
      return partyFetch(path, { ...options, headers }, false);
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : {};

    if (!response.ok) {
      const details = Array.isArray(payload.details) ? ` ${payload.details.join(' ')}` : '';
      throw new Error(`${payload.message || 'Erreur PartyFlow.'}${details}`);
    }

    return payload;
  }

  function getDefaultNickname() {
    const user = readJSON('todoflowUser', readJSON('todoUser', null));
    const prefix = user?.email ? user.email.split('@')[0] : '';
    return (prefix || 'Capitaine Chaos').replace(/[^a-z0-9_.-]/gi, '').slice(0, 24) || 'Capitaine Chaos';
  }

  function populateAvatarSelect(select, selected = AVATARS[0]) {
    select.replaceChildren(...AVATARS.map((avatar) => {
      const option = document.createElement('option');
      option.value = avatar;
      option.textContent = avatar;
      option.selected = avatar === selected;
      return option;
    }));
  }

  function rememberRoom(room) {
    if (!room?.code) {
      return;
    }

    const existing = readJSON(recentRoomsKey, []);
    const next = [
      {
        code: room.code,
        name: room.name,
        savedAt: new Date().toISOString()
      },
      ...existing.filter((item) => item.code !== room.code)
    ].slice(0, 5);

    localStorage.setItem(recentRoomsKey, JSON.stringify(next));
    renderRecentRooms();
  }

  function renderRecentRooms() {
    const rooms = readJSON(recentRoomsKey, []);

    if (!rooms.length) {
      const empty = document.createElement('p');
      empty.className = 'party-copy';
      empty.textContent = 'Aucune room recente. Le chaos attend son invitation.';
      elements.recentRoomsList.replaceChildren(empty);
      return;
    }

    elements.recentRoomsList.replaceChildren(...rooms.map((room) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-room-button';
      button.dataset.code = room.code;
      button.textContent = `${room.code} - ${room.name}`;
      return button;
    }));
  }

  function switchView(view, selectedTab = null) {
    const isParty = view === 'party';
    elements.todoSection.classList.toggle('hidden', isParty);
    elements.partySection.classList.toggle('hidden', !isParty);
    elements.modeTabs.forEach((tab) => {
      const active = selectedTab ? tab === selectedTab : tab.dataset.partyView === view;
      tab.classList.toggle('active', active);
    });

    if (isParty) {
      pollRoomNow();
    }
  }

  function setRoomState(roomState) {
    state.roomState = roomState;
    rememberRoom(roomState.room);
    renderRoom();
    startPolling();
  }

  function currentRoomCode() {
    return state.roomState?.room?.code || '';
  }

  function isCurrentHost() {
    return Boolean(state.roomState?.currentPlayer?.isHost);
  }

  function renderRoom() {
    const roomState = state.roomState;
    const hasRoom = Boolean(roomState?.room);

    elements.partyRoomPanel.classList.toggle('hidden', !hasRoom);

    if (!hasRoom) {
      return;
    }

    elements.activeRoomName.textContent = roomState.room.name;
    elements.activeRoomCode.textContent = roomState.room.code;
    renderPlayers(roomState.players || []);
    renderGame(roomState);
    renderMessages(roomState);
  }

  function renderPlayers(players) {
    elements.playerList.replaceChildren(...players.map((player, index) => {
      const item = document.createElement('li');
      item.className = 'player-row';

      const identity = document.createElement('span');
      identity.className = 'player-identity';
      identity.textContent = `${player.avatar} ${player.nickname}`;

      const meta = document.createElement('span');
      meta.className = 'player-meta';
      const flags = [
        player.isHost ? 'hote' : '',
        player.isReady ? 'pret' : 'pas pret',
        player.connected ? '' : 'offline'
      ].filter(Boolean).join(' / ');
      meta.textContent = `${index + 1}. ${player.score} pts - ${flags}`;

      item.append(identity, meta);
      return item;
    }));

    const current = state.roomState.currentPlayer;
    elements.readyButton.textContent = current?.isReady ? 'Pas pret' : 'Pret';
    elements.readyButton.disabled = !current;
    elements.startSpeedTodoButton.hidden = !isCurrentHost();
    elements.startSpeedTodoButton.disabled = state.roomState.room.status === 'playing';
  }

  function remainingSeconds(room, session) {
    if (!session?.startedAt || session.status !== 'collecting') {
      return null;
    }

    const started = new Date(session.startedAt).getTime();
    const duration = (room.settings?.roundDuration || 60) * 1000;
    return Math.max(0, Math.ceil((started + duration - Date.now()) / 1000));
  }

  function renderGame(roomState) {
    const { room, session } = roomState;
    const isHost = isCurrentHost();

    elements.speedTodoForm.classList.add('hidden');
    elements.voteBoard.classList.add('hidden');
    elements.resultBoard.classList.add('hidden');
    elements.endRoundButton.classList.add('hidden');
    elements.backToLobbyButton.classList.add('hidden');
    elements.gameTitle.textContent = 'Speed Todo';

    if (!session) {
      elements.gameTimer.textContent = '--';
      elements.gameRules.textContent = 'Choisis Speed Todo pour lancer une manche. Le serveur est pret, vos amities moins.';
      return;
    }

    if (session.status === 'collecting') {
      const remaining = remainingSeconds(room, session);
      elements.gameTimer.textContent = `${remaining}s`;
      elements.gameRules.textContent = 'Ecris une idee par ligne. Utile, drole ou chaotique: PartyFlow jugera avec une confiance excessive.';
      elements.speedTodoForm.classList.remove('hidden');

      if (isHost) {
        elements.endRoundButton.textContent = 'Passer au vote';
        elements.endRoundButton.classList.remove('hidden');
      }
      return;
    }

    if (session.status === 'voting') {
      elements.gameTimer.textContent = 'Vote';
      elements.gameRules.textContent = 'Vote pour une idee utile, une idee drole et une idee chaotique. Les auto-votes sont bloques.';
      renderVoteBoard(session);
      elements.voteBoard.classList.remove('hidden');

      if (isHost) {
        elements.endRoundButton.textContent = 'Calculer resultats';
        elements.endRoundButton.classList.remove('hidden');
      }
      return;
    }

    if (session.status === 'finished') {
      elements.gameTimer.textContent = 'Fini';
      elements.gameRules.textContent = 'Le classement est injuste, mais officiel.';
      renderResults(roomState);
      elements.resultBoard.classList.remove('hidden');

      if (isHost) {
        elements.backToLobbyButton.classList.remove('hidden');
      }
    }
  }

  function votedFor(category, submissionId, itemIndex) {
    const currentPlayerId = state.roomState?.currentPlayerId;
    const votes = state.roomState?.session?.votes || [];

    return votes.some((vote) => {
      return vote.playerId === currentPlayerId
        && vote.category === category
        && vote.submissionId === submissionId
        && Number(vote.itemIndex) === Number(itemIndex);
    });
  }

  function renderVoteBoard(session) {
    const currentPlayerId = state.roomState?.currentPlayerId;
    const cards = [];

    (session.submissions || []).forEach((submission) => {
      (submission.items || []).forEach((item, itemIndex) => {
        const card = document.createElement('article');
        card.className = 'vote-card';

        const title = document.createElement('strong');
        title.textContent = item.text;

        const author = document.createElement('span');
        author.className = 'party-copy';
        author.textContent = `${submission.avatar} ${submission.nickname}`;

        const actions = document.createElement('div');
        actions.className = 'vote-actions';

        [
          ['useful', 'Utile'],
          ['funny', 'Drole'],
          ['chaotic', 'Chaos']
        ].forEach(([category, label]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = votedFor(category, submission.id, itemIndex) ? 'secondary-button active-vote' : 'ghost-button';
          button.textContent = label;
          button.dataset.category = category;
          button.dataset.submissionId = submission.id;
          button.dataset.itemIndex = String(itemIndex);
          button.disabled = submission.playerId === currentPlayerId;
          actions.appendChild(button);
        });

        card.append(title, author, actions);
        cards.push(card);
      });
    });

    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className = 'party-copy';
      empty.textContent = 'Aucune idee a voter. Productivite introuvable, mais ambiance preservee.';
      elements.voteBoard.replaceChildren(empty);
      return;
    }

    elements.voteBoard.replaceChildren(...cards);
  }

  function renderResults(roomState) {
    const sessionScores = [...(roomState.session?.scores || [])]
      .sort((a, b) => b.points - a.points || String(a.nickname).localeCompare(String(b.nickname)));
    const totalScores = [...(roomState.players || [])].sort((a, b) => b.score - a.score);
    const winner = totalScores[0];
    const latestSummary = roomState.history?.[0]?.funnySummary || 'Le classement est injuste, mais officiel.';

    const fragment = document.createDocumentFragment();
    const headline = document.createElement('div');
    headline.className = 'winner-banner';
    headline.textContent = winner ? `${winner.avatar} ${winner.nickname} mene avec ${winner.score} pts` : 'Pas encore de gagnant';
    fragment.appendChild(headline);

    const summary = document.createElement('p');
    summary.className = 'party-copy';
    summary.textContent = latestSummary;
    fragment.appendChild(summary);

    const list = document.createElement('ol');
    list.className = 'result-list';
    totalScores.forEach((player) => {
      const item = document.createElement('li');
      const round = sessionScores.find((score) => String(score.playerId) === player.id);
      item.textContent = `${player.avatar} ${player.nickname} - ${player.score} pts (${round?.points || 0} cette manche)`;
      list.appendChild(item);
    });
    fragment.appendChild(list);

    elements.resultBoard.replaceChildren(fragment);
  }

  function renderMessages(roomState) {
    const playersById = new Map((roomState.players || []).map((player) => [player.id, player]));
    const nodes = (roomState.messages || []).map((message) => {
      const item = document.createElement('div');
      item.className = `room-message ${message.type}`;
      const player = playersById.get(message.playerId);
      item.textContent = message.type === 'user' && player
        ? `${player.avatar} ${player.nickname}: ${message.message}`
        : message.message;
      return item;
    });

    elements.roomMessages.replaceChildren(...nodes);
    elements.roomMessages.scrollTop = elements.roomMessages.scrollHeight;
  }

  async function pollRoomNow() {
    const code = currentRoomCode();

    if (!code) {
      return;
    }

    try {
      const roomState = await partyFetch(`/rooms/${code}`);
      state.roomState = roomState;
      renderRoom();
    } catch (error) {
      setStatus(error.message, 'error');
      stopPolling();
    }
  }

  function startPolling() {
    stopPolling();
    state.pollTimer = window.setInterval(pollRoomNow, pollDelay);
  }

  function stopPolling() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = 0;
    }
  }

  function roomPayloadFromCreateForm() {
    return {
      name: elements.roomNameInput.value,
      nickname: elements.partyNicknameInput.value || getDefaultNickname(),
      avatar: elements.partyAvatarSelect.value,
      settings: {
        maxPlayers: Number(elements.maxPlayersInput.value),
        roundDuration: Number(elements.roundDurationSelect.value),
        chaosMode: elements.chaosModeInput.checked,
        enableChat: true,
        familyFriendlyMode: true,
        allowAnonymousPlayers: true
      }
    };
  }

  function joinPayloadFromForm(code = elements.roomCodeInput.value) {
    return {
      code,
      nickname: elements.joinNicknameInput.value || elements.partyNicknameInput.value || getDefaultNickname(),
      avatar: elements.joinAvatarSelect.value || elements.partyAvatarSelect.value
    };
  }

  async function handleCreateRoom(event) {
    event.preventDefault();

    if (state.submitting) {
      return;
    }

    try {
      state.submitting = true;
      setStatus('Creation de la salle. Le chaos met ses chaussures...', '');
      const roomState = await partyFetch('/rooms', {
        method: 'POST',
        body: JSON.stringify(roomPayloadFromCreateForm())
      });
      setRoomState(roomState);
      setStatus('Salle creee. Le serveur a survecu.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      state.submitting = false;
    }
  }

  async function handleJoinRoom(event, forcedCode) {
    event?.preventDefault();

    if (state.submitting) {
      return;
    }

    try {
      state.submitting = true;
      setStatus('Entree dans la salle...', '');
      const roomState = await partyFetch('/rooms/join', {
        method: 'POST',
        body: JSON.stringify(joinPayloadFromForm(forcedCode))
      });
      setRoomState(roomState);
      setStatus('Tu es dans la room. Mission acceptee.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      state.submitting = false;
    }
  }

  async function startSpeedTodo() {
    try {
      const roomState = await partyFetch(`/rooms/${currentRoomCode()}/games/start`, {
        method: 'POST',
        body: JSON.stringify({ gameType: 'speed_todo' })
      });
      setRoomState(roomState);
      showToast('Speed Todo lance. Pas de panique visible.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function submitSpeedTodo(event) {
    event.preventDefault();

    try {
      const roomState = await partyFetch(`/rooms/${currentRoomCode()}/games/submit`, {
        method: 'POST',
        body: JSON.stringify({ text: elements.speedTodoInput.value })
      });
      setRoomState(roomState);
      showToast('Idees envoyees. Dignite non garantie.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function vote(category, submissionId, itemIndex) {
    try {
      const roomState = await partyFetch(`/rooms/${currentRoomCode()}/games/vote`, {
        method: 'POST',
        body: JSON.stringify({ category, submissionId, itemIndex })
      });
      setRoomState(roomState);
      showToast('Vote enregistre. Quelqu un va regretter.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function endRound() {
    try {
      const roomState = await partyFetch(`/rooms/${currentRoomCode()}/games/end-round`, {
        method: 'POST'
      });
      setRoomState(roomState);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function resetToLobby() {
    try {
      const roomState = await partyFetch(`/rooms/${currentRoomCode()}/games/lobby`, {
        method: 'POST'
      });
      setRoomState(roomState);
      showToast('Retour lobby. Les scores restent officiels.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function toggleReady() {
    try {
      const isReady = !state.roomState?.currentPlayer?.isReady;
      const roomState = await partyFetch(`/rooms/${currentRoomCode()}/ready`, {
        method: 'POST',
        body: JSON.stringify({ isReady })
      });
      setRoomState(roomState);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function leaveRoom() {
    try {
      await partyFetch(`/rooms/${currentRoomCode()}/leave`, { method: 'POST' });
      state.roomState = null;
      stopPolling();
      renderRoom();
      setStatus('Tu as quitte la salle. Le classement fera semblant de comprendre.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const message = elements.roomMessageInput.value.trim();

    if (!message) {
      return;
    }

    try {
      const messages = await partyFetch(`/rooms/${currentRoomCode()}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      elements.roomMessageInput.value = '';
      state.roomState.messages = messages;
      renderMessages(state.roomState);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  function bindEvents() {
    elements.modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => switchView(tab.dataset.partyView, tab));
    });
    elements.createRoomForm.addEventListener('submit', handleCreateRoom);
    elements.joinRoomForm.addEventListener('submit', handleJoinRoom);
    elements.refreshRoomButton.addEventListener('click', pollRoomNow);
    elements.copyRoomCodeButton.addEventListener('click', async () => {
      const code = currentRoomCode();

      if (!code) {
        return;
      }

      try {
        await navigator.clipboard.writeText(code);
        showToast('Code copie. L invitation est officiellement dangereuse.', 'success');
      } catch (error) {
        setStatus(`Code: ${code}`, 'success');
      }
    });
    elements.readyButton.addEventListener('click', toggleReady);
    elements.startSpeedTodoButton.addEventListener('click', startSpeedTodo);
    elements.leaveRoomButton.addEventListener('click', leaveRoom);
    elements.speedTodoForm.addEventListener('submit', submitSpeedTodo);
    elements.endRoundButton.addEventListener('click', endRound);
    elements.backToLobbyButton.addEventListener('click', resetToLobby);
    elements.roomMessageForm.addEventListener('submit', sendMessage);
    elements.voteBoard.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-category]');

      if (button) {
        vote(button.dataset.category, button.dataset.submissionId, Number(button.dataset.itemIndex));
      }
    });
    elements.recentRoomsList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-code]');

      if (button) {
        elements.roomCodeInput.value = button.dataset.code;
        handleJoinRoom(event, button.dataset.code);
      }
    });
    window.addEventListener('online', pollRoomNow);
    window.addEventListener('beforeunload', stopPolling);
  }

  function init() {
    const nickname = getDefaultNickname();
    elements.partyNicknameInput.value = nickname;
    elements.joinNicknameInput.value = nickname;
    populateAvatarSelect(elements.partyAvatarSelect, AVATARS[3]);
    populateAvatarSelect(elements.joinAvatarSelect, AVATARS[1]);
    renderRecentRooms();
    bindEvents();
  }

  init();
})();
