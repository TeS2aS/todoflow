'use strict';

(() => {
  const staticPreviewPorts = new Set(['3000', '5173', '5500']);
  const runtimeConfig = window.TODOFLOW_CONFIG || {};
  const storageKeys = {
    accessToken: 'todoflowAccessToken',
    refreshToken: 'todoflowRefreshToken',
    user: 'todoflowUser',
    legacyToken: 'todoToken',
    legacyUser: 'todoUser'
  };
  const reactionOptions = [
    String.fromCodePoint(0x1F44D),
    String.fromCodePoint(0x1F602),
    String.fromCodePoint(0x1F525),
    String.fromCodePoint(0x1F4A1)
  ];
  const gamePollMs = 2000;
  const chatPollMs = 3000;

  const elements = {
    dashboardView: document.querySelector('#dashboardView'),
    featureTabs: [...document.querySelectorAll('[data-feature-target]')],
    featureSections: [...document.querySelectorAll('.feature-section')],
    dashboardAssistantBadge: document.querySelector('#dashboardAssistantBadge'),
    assistantSection: document.querySelector('#assistantSection'),
    assistantOutput: document.querySelector('#assistantOutput'),
    assistantDailyButton: document.querySelector('#assistantDailyButton'),
    assistantTestInput: document.querySelector('#assistantTestInput'),
    assistantTestButton: document.querySelector('#assistantTestButton'),
    assistantRewriteButton: document.querySelector('#assistantRewriteButton'),
    customAssistantForm: document.querySelector('#customAssistantForm'),
    assistantName: document.querySelector('#assistantName'),
    assistantColor: document.querySelector('#assistantColor'),
    assistantTone: document.querySelector('#assistantTone'),
    assistantGoals: document.querySelector('#assistantGoals'),
    assistantCatchphrases: document.querySelector('#assistantCatchphrases'),
    assistantIntensity: document.querySelector('#assistantIntensity'),
    customAssistantPreview: document.querySelector('#customAssistantPreview'),
    chatMessages: document.querySelector('#chatMessages'),
    chatForm: document.querySelector('#chatForm'),
    chatType: document.querySelector('#chatType'),
    chatInput: document.querySelector('#chatInput'),
    chatRefreshButton: document.querySelector('#chatRefreshButton'),
    chatStatus: document.querySelector('#chatStatus'),
    groupCreateForm: document.querySelector('#groupCreateForm'),
    groupJoinForm: document.querySelector('#groupJoinForm'),
    groupName: document.querySelector('#groupName'),
    groupDescription: document.querySelector('#groupDescription'),
    groupAvatarUrl: document.querySelector('#groupAvatarUrl'),
    groupInviteCode: document.querySelector('#groupInviteCode'),
    groupsList: document.querySelector('#groupsList'),
    groupsRefreshButton: document.querySelector('#groupsRefreshButton'),
    groupDetailPanel: document.querySelector('#groupDetailPanel'),
    groupAvatarPreview: document.querySelector('#groupAvatarPreview'),
    activeGroupName: document.querySelector('#activeGroupName'),
    activeGroupMeta: document.querySelector('#activeGroupMeta'),
    groupEditForm: document.querySelector('#groupEditForm'),
    groupEditAvatarUrl: document.querySelector('#groupEditAvatarUrl'),
    groupInviteForm: document.querySelector('#groupInviteForm'),
    groupInviteEmail: document.querySelector('#groupInviteEmail'),
    groupMembers: document.querySelector('#groupMembers'),
    groupMessages: document.querySelector('#groupMessages'),
    groupMessageForm: document.querySelector('#groupMessageForm'),
    groupMessageType: document.querySelector('#groupMessageType'),
    groupMessageInput: document.querySelector('#groupMessageInput'),
    groupLeaveButton: document.querySelector('#groupLeaveButton'),
    groupDeleteButton: document.querySelector('#groupDeleteButton'),
    groupsStatus: document.querySelector('#groupsStatus'),
    gameCreateForm: document.querySelector('#gameCreateForm'),
    gameJoinForm: document.querySelector('#gameJoinForm'),
    gameNickname: document.querySelector('#gameNickname'),
    gameTheme: document.querySelector('#gameTheme'),
    gameRoomCode: document.querySelector('#gameRoomCode'),
    gameRoomPanel: document.querySelector('#gameRoomPanel'),
    activeGameCode: document.querySelector('#activeGameCode'),
    activeGameTheme: document.querySelector('#activeGameTheme'),
    gameTimerValue: document.querySelector('#gameTimerValue'),
    gamePlayers: document.querySelector('#gamePlayers'),
    gameReadyButton: document.querySelector('#gameReadyButton'),
    gameStartButton: document.querySelector('#gameStartButton'),
    gameFinishButton: document.querySelector('#gameFinishButton'),
    gameSubmissionForm: document.querySelector('#gameSubmissionForm'),
    gameSubmissionInput: document.querySelector('#gameSubmissionInput'),
    gameSubmissions: document.querySelector('#gameSubmissions'),
    gameVoteBoard: document.querySelector('#gameVoteBoard'),
    gameResults: document.querySelector('#gameResults'),
    gameRefreshButton: document.querySelector('#gameRefreshButton'),
    gameStatus: document.querySelector('#gameStatus'),
    profileEmail: document.querySelector('#profileEmail'),
    toastRoot: document.querySelector('#toastRoot')
  };

  if (!elements.dashboardView) {
    return;
  }

  const state = {
    activeSection: 'tasksSection',
    assistant: null,
    groups: [],
    activeGroup: null,
    activeGroupMembers: [],
    gameState: null,
    gamePollTimer: 0,
    chatPollTimer: 0
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

  function getSession() {
    return {
      accessToken: localStorage.getItem(storageKeys.accessToken) || localStorage.getItem(storageKeys.legacyToken) || '',
      refreshToken: localStorage.getItem(storageKeys.refreshToken) || '',
      user: readJSON(storageKeys.user, readJSON(storageKeys.legacyUser, null))
    };
  }

  function setStatus(element, message, type = '') {
    if (!element) {
      return;
    }

    element.className = `status ${type}`.trim();
    element.textContent = message;
  }

  function showToast(message, type = '') {
    if (!elements.toastRoot) {
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.textContent = message;
    elements.toastRoot.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3400);
  }

  async function refreshSession() {
    const { refreshToken } = getSession();

    if (!refreshToken) {
      throw new Error('Session expiree.');
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

    localStorage.setItem(storageKeys.accessToken, payload.accessToken || payload.token || '');
    localStorage.setItem(storageKeys.refreshToken, payload.refreshToken || refreshToken);
    localStorage.setItem(storageKeys.user, JSON.stringify(payload.user));
    return payload.accessToken || payload.token || '';
  }

  async function apiFetch(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    const { accessToken } = getSession();

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(buildApiUrl(path), {
      ...options,
      headers
    });

    if (response.status === 401 && retry) {
      const token = await refreshSession();
      headers.set('Authorization', `Bearer ${token}`);
      return apiFetch(path, { ...options, headers }, false);
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : {};

    if (!response.ok) {
      const details = Array.isArray(payload.details) ? ` ${payload.details.join(' ')}` : '';
      throw new Error(`${payload.message || 'Erreur serveur.'}${details}`);
    }

    return payload;
  }

  function normalizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function parseCsv(value) {
    return normalizeText(value)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
  }

  function ownUserId() {
    return getSession().user?.id || getSession().user?._id || '';
  }

  function switchSection(targetId) {
    state.activeSection = targetId;
    elements.featureSections.forEach((section) => {
      section.classList.toggle('hidden', section.id !== targetId);
      section.classList.toggle('active', section.id === targetId);
    });
    elements.featureTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.featureTarget === targetId && document.activeElement === tab);
    });

    if (targetId === 'chatSection') {
      loadChat();
      startChatPolling();
    } else {
      stopChatPolling();
    }

    if (targetId === 'groupsSection') {
      loadGroups();
    }

    if (targetId === 'assistantSection') {
      loadAssistant();
    }

    if (targetId === 'gameSection') {
      pollGameNow();
    }

    if (targetId === 'profileSection') {
      renderProfile();
    }
  }

  function renderProfile() {
    const { user } = getSession();
    elements.profileEmail.textContent = user?.email ? `Email: ${user.email}` : 'Aucune session active.';
  }

  function renderAssistantBadge(profile) {
    if (!elements.dashboardAssistantBadge) {
      return;
    }

    if (!profile) {
      elements.dashboardAssistantBadge.textContent = 'Assistant: Mambo';
      return;
    }

    elements.dashboardAssistantBadge.textContent = `${profile.avatar || profile.name.charAt(0)} ${profile.name} - intensite ${profile.intensity}`;
    elements.dashboardAssistantBadge.style.borderColor = profile.color || '';
  }

  function renderAssistantOutput(payload) {
    elements.assistantOutput.replaceChildren();

    const message = document.createElement('div');
    message.className = 'ai-chip';
    message.textContent = payload.message || payload.rewrite || 'Assistant pret.';
    elements.assistantOutput.appendChild(message);

    if (payload.rewrite) {
      const rewrite = document.createElement('div');
      rewrite.className = 'ai-chip';
      rewrite.textContent = `Reformulation: ${payload.rewrite}`;
      elements.assistantOutput.appendChild(rewrite);
    }

    (payload.suggestions || []).forEach((suggestion) => {
      const item = document.createElement('div');
      item.className = 'ai-chip';
      item.textContent = `${suggestion.title} (${suggestion.priority})`;
      elements.assistantOutput.appendChild(item);
    });

    if (payload.analysis) {
      const analysis = document.createElement('div');
      analysis.className = 'ai-chip';
      analysis.textContent = `${payload.analysis.active} actives, ${payload.analysis.overdue} en retard. ${payload.analysis.advice}`;
      elements.assistantOutput.appendChild(analysis);
    }
  }

  async function loadAssistant() {
    try {
      const profile = await apiFetch('/assistants/me');
      state.assistant = profile;
      renderAssistantBadge(profile);
      elements.assistantName.value = profile.name || '';
      elements.assistantColor.value = /^#[0-9a-f]{6}$/i.test(profile.color || '') ? profile.color : '#0b7a75';
      elements.assistantTone.value = profile.tone || 'drole';
      elements.assistantGoals.value = (profile.goals || []).join(', ');
      elements.assistantCatchphrases.value = (profile.catchphrases || []).join('\n');
      elements.assistantIntensity.value = String(profile.intensity || 3);
      elements.customAssistantPreview.textContent = profile.avatar || profile.name?.charAt(0) || 'AI';
    } catch (error) {
      renderAssistantBadge(null);
    }
  }

  async function selectAssistant(preset) {
    try {
      const profile = await apiFetch('/assistants/select', {
        method: 'POST',
        body: JSON.stringify({ preset })
      });
      state.assistant = profile;
      renderAssistantBadge(profile);
      showToast(`${profile.name} est actif.`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function saveCustomAssistant(event) {
    event.preventDefault();

    try {
      const profile = await apiFetch('/assistants/custom', {
        method: 'POST',
        body: JSON.stringify({
          name: elements.assistantName.value,
          avatar: normalizeText(elements.assistantName.value).charAt(0).toUpperCase() || 'AI',
          color: elements.assistantColor.value,
          tone: elements.assistantTone.value,
          goals: parseCsv(elements.assistantGoals.value),
          intensity: Number(elements.assistantIntensity.value),
          catchphrases: elements.assistantCatchphrases.value.split('\n').map(normalizeText).filter(Boolean)
        })
      });
      state.assistant = profile;
      renderAssistantBadge(profile);
      showToast('Assistant sauvegarde.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function testAssistant() {
    try {
      const payload = await apiFetch('/assistants/message', {
        method: 'POST',
        body: JSON.stringify({ message: elements.assistantTestInput.value })
      });
      renderAssistantOutput(payload);
      renderAssistantBadge(payload.profile);
    } catch (error) {
      renderAssistantOutput({ message: error.message });
    }
  }

  async function rewriteWithAssistant() {
    try {
      const payload = await apiFetch('/assistants/rewrite-task', {
        method: 'POST',
        body: JSON.stringify({ title: elements.assistantTestInput.value })
      });
      renderAssistantOutput(payload);
    } catch (error) {
      renderAssistantOutput({ message: error.message });
    }
  }

  async function loadDailyAssistant() {
    try {
      const payload = await apiFetch('/assistants/daily');
      renderAssistantOutput(payload);
      renderAssistantBadge(payload.profile);
    } catch (error) {
      renderAssistantOutput({ message: error.message });
    }
  }

  function isSafeHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  function appendTextWithLinks(container, text) {
    const pattern = /\bhttps?:\/\/[^\s<>"']+/gi;
    let lastIndex = 0;
    let match = pattern.exec(text);

    while (match) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const url = match[0];

      if (isSafeHttpUrl(url)) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = url;
        container.appendChild(link);
      } else {
        container.appendChild(document.createTextNode(url));
      }

      lastIndex = pattern.lastIndex;
      match = pattern.exec(text);
    }

    if (lastIndex < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }

  function createMediaNode(message) {
    if (!isSafeHttpUrl(message.content)) {
      return document.createTextNode(message.content);
    }

    const link = document.createElement('a');
    link.href = message.content;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const image = document.createElement('img');
    image.src = message.content;
    image.alt = message.type === 'gif' ? 'GIF' : 'Image';
    image.loading = 'lazy';
    link.appendChild(image);
    return link;
  }

  function createMessageNode(message, context = 'chat') {
    const card = document.createElement('article');
    card.className = `chat-message ${message.deletedAt ? 'deleted' : ''}`.trim();

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    const date = new Date(message.createdAt);
    meta.textContent = `${message.avatar || 'U'} ${message.username || 'user'} - ${Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    const body = document.createElement('div');
    body.className = 'chat-body';

    if (message.type === 'image' || message.type === 'gif') {
      body.appendChild(createMediaNode(message));
    } else {
      appendTextWithLinks(body, message.content || '');
    }

    if (message.linkPreview?.url) {
      const preview = document.createElement('a');
      preview.className = 'link-preview';
      preview.href = message.linkPreview.url;
      preview.target = '_blank';
      preview.rel = 'noopener noreferrer';
      preview.textContent = message.linkPreview.title || message.linkPreview.url;
      body.appendChild(preview);
    }

    const actions = document.createElement('div');
    actions.className = 'chat-actions';
    reactionOptions.forEach((emoji) => {
      const reaction = (message.reactions || []).find((item) => item.emoji === emoji);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = reaction?.reacted ? 'icon-button active-vote' : 'icon-button';
      button.textContent = `${emoji} ${reaction?.count || ''}`.trim();
      button.dataset.messageId = message.id;
      button.dataset.emoji = emoji;
      button.dataset.context = context;
      actions.appendChild(button);
    });

    if (message.canDelete) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button danger';
      remove.textContent = 'Supprimer';
      remove.dataset.deleteMessageId = message.id;
      remove.dataset.context = context;
      actions.appendChild(remove);
    }

    card.append(meta, body, actions);
    return card;
  }

  function renderChat(messages) {
    elements.chatMessages.replaceChildren(...messages.map((message) => createMessageNode(message, 'chat')));
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  async function loadChat(silent = false) {
    try {
      const messages = await apiFetch('/chat/messages');
      renderChat(messages);
      if (!silent) {
        setStatus(elements.chatStatus, '', '');
      }
    } catch (error) {
      if (!silent) {
        setStatus(elements.chatStatus, error.message, 'error');
      }
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const content = elements.chatInput.value.trim();

    if (!content) {
      return;
    }

    try {
      await apiFetch('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          type: elements.chatType.value,
          content
        })
      });
      elements.chatInput.value = '';
      await loadChat(true);
    } catch (error) {
      setStatus(elements.chatStatus, error.message, 'error');
    }
  }

  async function toggleReaction(messageId, emoji, context) {
    try {
      const message = await apiFetch(`/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });

      if (context === 'group') {
        await loadGroupMessages();
      } else {
        await loadChat(true);
      }

      return message;
    } catch (error) {
      showToast(error.message, 'error');
      return null;
    }
  }

  async function deleteChatMessage(messageId, context) {
    try {
      await apiFetch(`/chat/messages/${messageId}`, { method: 'DELETE' });

      if (context === 'group') {
        await loadGroupMessages();
      } else {
        await loadChat(true);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function startChatPolling() {
    stopChatPolling();
    state.chatPollTimer = window.setInterval(() => loadChat(true), chatPollMs);
  }

  function stopChatPolling() {
    if (state.chatPollTimer) {
      window.clearInterval(state.chatPollTimer);
      state.chatPollTimer = 0;
    }
  }

  function renderGroups() {
    if (!state.groups.length) {
      const empty = document.createElement('p');
      empty.className = 'status';
      empty.textContent = 'Aucun groupe.';
      elements.groupsList.replaceChildren(empty);
      return;
    }

    elements.groupsList.replaceChildren(...state.groups.map((group) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'list-button';
      button.dataset.groupId = group.id;
      button.textContent = `${group.name} - ${group.role}`;
      return button;
    }));
  }

  async function loadGroups() {
    try {
      state.groups = await apiFetch('/groups');
      renderGroups();
      setStatus(elements.groupsStatus, '', '');
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function selectGroup(groupId) {
    try {
      const group = await apiFetch(`/groups/${groupId}`);
      state.activeGroup = group;
      elements.groupDetailPanel.classList.remove('hidden');
      elements.activeGroupName.textContent = group.name;
      elements.activeGroupMeta.textContent = `Code: ${group.inviteCode} - role: ${group.role}`;
      elements.groupEditAvatarUrl.value = group.avatarUrl || '';
      elements.groupDeleteButton.hidden = group.role !== 'owner';
      elements.groupAvatarPreview.classList.toggle('hidden', !group.avatarUrl);

      if (group.avatarUrl) {
        elements.groupAvatarPreview.src = group.avatarUrl;
      }

      await Promise.all([loadGroupMembers(), loadGroupMessages()]);
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function loadGroupMembers() {
    if (!state.activeGroup) {
      return;
    }

    state.activeGroupMembers = await apiFetch(`/groups/${state.activeGroup.id}/members`);
    elements.groupMembers.replaceChildren(...state.activeGroupMembers.map((member) => {
      const row = document.createElement('div');
      row.className = 'member-row';
      row.textContent = `${member.email || member.userId} - ${member.role}`;
      return row;
    }));
  }

  async function loadGroupMessages() {
    if (!state.activeGroup) {
      return;
    }

    const messages = await apiFetch(`/groups/${state.activeGroup.id}/messages`);
    elements.groupMessages.replaceChildren(...messages.map((message) => createMessageNode(message, 'group')));
    elements.groupMessages.scrollTop = elements.groupMessages.scrollHeight;
  }

  async function createGroup(event) {
    event.preventDefault();

    try {
      const group = await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: elements.groupName.value,
          description: elements.groupDescription.value,
          avatarUrl: elements.groupAvatarUrl.value
        })
      });
      elements.groupCreateForm.reset();
      await loadGroups();
      await selectGroup(group.id);
      showToast('Groupe cree.', 'success');
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function joinGroup(event) {
    event.preventDefault();

    try {
      const group = await apiFetch('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: elements.groupInviteCode.value })
      });
      elements.groupJoinForm.reset();
      await loadGroups();
      await selectGroup(group.id);
      showToast('Groupe rejoint.', 'success');
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function updateGroup(event) {
    event.preventDefault();

    if (!state.activeGroup) {
      return;
    }

    try {
      const group = await apiFetch(`/groups/${state.activeGroup.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: elements.groupEditAvatarUrl.value })
      });
      state.activeGroup = group;
      await loadGroups();
      await selectGroup(group.id);
      showToast('Groupe modifie.', 'success');
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function inviteGroupUser(event) {
    event.preventDefault();

    if (!state.activeGroup) {
      return;
    }

    try {
      const result = await apiFetch(`/groups/${state.activeGroup.id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: elements.groupInviteEmail.value })
      });
      elements.groupInviteEmail.value = '';
      setStatus(elements.groupsStatus, `Invitation prete. Code: ${result.inviteCode}`, 'success');
      await loadGroupMembers();
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function sendGroupMessage(event) {
    event.preventDefault();

    if (!state.activeGroup || !elements.groupMessageInput.value.trim()) {
      return;
    }

    try {
      await apiFetch(`/groups/${state.activeGroup.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          type: elements.groupMessageType.value,
          content: elements.groupMessageInput.value
        })
      });
      elements.groupMessageInput.value = '';
      await loadGroupMessages();
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function leaveGroup() {
    if (!state.activeGroup) {
      return;
    }

    try {
      await apiFetch(`/groups/${state.activeGroup.id}/members/${ownUserId()}`, { method: 'DELETE' });
      state.activeGroup = null;
      elements.groupDetailPanel.classList.add('hidden');
      await loadGroups();
      showToast('Groupe quitte.', 'success');
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  async function deleteGroup() {
    if (!state.activeGroup || !window.confirm('Supprimer ce groupe ?')) {
      return;
    }

    try {
      await apiFetch(`/groups/${state.activeGroup.id}`, { method: 'DELETE' });
      state.activeGroup = null;
      elements.groupDetailPanel.classList.add('hidden');
      await loadGroups();
      showToast('Groupe supprime.', 'success');
    } catch (error) {
      setStatus(elements.groupsStatus, error.message, 'error');
    }
  }

  function startGamePolling() {
    stopGamePolling();
    state.gamePollTimer = window.setInterval(pollGameNow, gamePollMs);
  }

  function stopGamePolling() {
    if (state.gamePollTimer) {
      window.clearInterval(state.gamePollTimer);
      state.gamePollTimer = 0;
    }
  }

  async function pollGameNow() {
    const code = state.gameState?.room?.code;

    if (!code || state.activeSection !== 'gameSection') {
      return;
    }

    try {
      state.gameState = await apiFetch(`/game/rooms/${code}`);
      renderGame();
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
      stopGamePolling();
    }
  }

  function secondsLeft(room) {
    if (!room?.roundEndsAt || room.status !== 'playing') {
      return room?.status === 'voting' ? 'Vote' : room?.status === 'finished' ? 'Fini' : 'Lobby';
    }

    const remaining = Math.max(0, Math.ceil((new Date(room.roundEndsAt).getTime() - Date.now()) / 1000));
    return `${remaining}s`;
  }

  function renderGame() {
    const gameState = state.gameState;
    const hasRoom = Boolean(gameState?.room);

    elements.gameRoomPanel.classList.toggle('hidden', !hasRoom);

    if (!hasRoom) {
      return;
    }

    const { room, players, currentPlayer, submissions, results } = gameState;
    elements.activeGameCode.textContent = `Room ${room.code}`;
    elements.activeGameTheme.textContent = `${room.theme} - ${room.status}`;
    elements.gameTimerValue.textContent = secondsLeft(room);
    elements.gameStartButton.hidden = !currentPlayer?.isHost || room.status !== 'lobby';
    elements.gameFinishButton.hidden = !currentPlayer?.isHost || !['playing', 'voting'].includes(room.status);
    elements.gameReadyButton.disabled = room.status !== 'lobby';
    elements.gameReadyButton.textContent = currentPlayer?.isReady ? 'Pas pret' : 'Pret';
    elements.gameSubmissionForm.classList.toggle('hidden', room.status !== 'playing');

    elements.gamePlayers.replaceChildren(...(players || []).map((player) => {
      const row = document.createElement('div');
      row.className = 'member-row';
      row.textContent = `${player.avatar || 'P'} ${player.nickname} - ${player.score} pts - ${player.isReady ? 'pret' : 'attente'}`;
      return row;
    }));

    elements.gameSubmissions.replaceChildren(...(submissions || []).map((submission) => {
      const row = document.createElement('div');
      row.className = 'submission-row';
      row.textContent = submission.content
        ? `${submission.avatar || 'P'} ${submission.nickname}: ${submission.content}`
        : `${submission.nickname}: reponse cachee`;
      return row;
    }));

    renderVoteBoard(gameState);
    renderGameResults(results);
  }

  function renderVoteBoard(gameState) {
    elements.gameVoteBoard.replaceChildren();

    if (gameState.room.status !== 'voting') {
      return;
    }

    const currentUserId = ownUserId();
    const voted = new Map((gameState.votes || [])
      .filter((vote) => vote.voterId === currentUserId)
      .map((vote) => [vote.category, vote.submissionId]));

    (gameState.submissions || []).forEach((submission) => {
      if (!submission.content) {
        return;
      }

      const card = document.createElement('article');
      card.className = 'vote-card';
      const title = document.createElement('strong');
      title.textContent = submission.content;
      const author = document.createElement('span');
      author.className = 'status';
      author.textContent = `${submission.avatar || 'P'} ${submission.nickname}`;
      const actions = document.createElement('div');
      actions.className = 'vote-actions';

      [
        ['funny', 'Drole'],
        ['useful', 'Utile'],
        ['chaotic', 'Chaos']
      ].forEach(([category, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = voted.get(category) === submission.id ? 'secondary-button active-vote' : 'ghost-button';
        button.textContent = label;
        button.dataset.submissionId = submission.id;
        button.dataset.voteCategory = category;
        button.disabled = submission.userId === currentUserId;
        actions.appendChild(button);
      });

      card.append(title, author, actions);
      elements.gameVoteBoard.appendChild(card);
    });
  }

  function renderGameResults(results) {
    elements.gameResults.replaceChildren();

    if (!results) {
      return;
    }

    const winner = document.createElement('div');
    winner.className = 'winner-banner';
    winner.textContent = results.winner
      ? `${results.winner.avatar || 'P'} ${results.winner.nickname} gagne avec ${results.winner.score} pts`
      : 'Pas encore de gagnant';
    elements.gameResults.appendChild(winner);

    const badge = document.createElement('p');
    badge.className = 'status success';
    badge.textContent = results.badge;
    elements.gameResults.appendChild(badge);

    const list = document.createElement('ol');
    list.className = 'result-list';
    (results.ranking || []).forEach((score) => {
      const item = document.createElement('li');
      item.textContent = `${score.avatar || 'P'} ${score.nickname} - ${score.score} pts`;
      list.appendChild(item);
    });
    elements.gameResults.appendChild(list);
  }

  async function createGameRoom(event) {
    event.preventDefault();

    try {
      state.gameState = await apiFetch('/game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          nickname: elements.gameNickname.value || getSession().user?.email?.split('@')[0],
          theme: elements.gameTheme.value
        })
      });
      renderGame();
      startGamePolling();
      setStatus(elements.gameStatus, 'Partie creee.', 'success');
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  async function joinGameRoom(event) {
    event.preventDefault();

    try {
      state.gameState = await apiFetch('/game/rooms/join', {
        method: 'POST',
        body: JSON.stringify({
          code: elements.gameRoomCode.value,
          nickname: elements.gameNickname.value || getSession().user?.email?.split('@')[0]
        })
      });
      renderGame();
      startGamePolling();
      setStatus(elements.gameStatus, 'Room rejointe.', 'success');
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  async function toggleGameReady() {
    const code = state.gameState?.room?.code;

    if (!code) {
      return;
    }

    try {
      state.gameState = await apiFetch(`/game/rooms/${code}/ready`, {
        method: 'POST',
        body: JSON.stringify({ isReady: !state.gameState.currentPlayer?.isReady })
      });
      renderGame();
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  async function startGame() {
    const code = state.gameState?.room?.code;

    if (!code) {
      return;
    }

    try {
      state.gameState = await apiFetch(`/game/rooms/${code}/start`, { method: 'POST' });
      renderGame();
      startGamePolling();
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  async function finishGame() {
    const code = state.gameState?.room?.code;

    if (!code) {
      return;
    }

    try {
      state.gameState = await apiFetch(`/game/rooms/${code}/finish`, { method: 'POST' });
      renderGame();
      stopGamePolling();
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  async function submitGameIdea(event) {
    event.preventDefault();
    const code = state.gameState?.room?.code;
    const content = elements.gameSubmissionInput.value.trim();

    if (!code || !content) {
      return;
    }

    try {
      await apiFetch(`/game/rooms/${code}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      elements.gameSubmissionInput.value = '';
      await pollGameNow();
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  async function voteGame(submissionId, category) {
    const code = state.gameState?.room?.code;

    if (!code) {
      return;
    }

    try {
      state.gameState = await apiFetch(`/game/rooms/${code}/votes`, {
        method: 'POST',
        body: JSON.stringify({ submissionId, category })
      });
      renderGame();
    } catch (error) {
      setStatus(elements.gameStatus, error.message, 'error');
    }
  }

  function bindEvents() {
    elements.featureTabs.forEach((tab) => {
      tab.addEventListener('click', () => switchSection(tab.dataset.featureTarget));
    });

    document.addEventListener('click', (event) => {
      const assistantButton = event.target.closest('[data-assistant-select]');

      if (assistantButton) {
        selectAssistant(assistantButton.dataset.assistantSelect);
      }

      const groupButton = event.target.closest('[data-group-id]');

      if (groupButton) {
        selectGroup(groupButton.dataset.groupId);
      }

      const reactionButton = event.target.closest('[data-message-id][data-emoji]');

      if (reactionButton) {
        toggleReaction(reactionButton.dataset.messageId, reactionButton.dataset.emoji, reactionButton.dataset.context);
      }

      const deleteButton = event.target.closest('[data-delete-message-id]');

      if (deleteButton) {
        deleteChatMessage(deleteButton.dataset.deleteMessageId, deleteButton.dataset.context);
      }

      const voteButton = event.target.closest('[data-submission-id][data-vote-category]');

      if (voteButton) {
        voteGame(voteButton.dataset.submissionId, voteButton.dataset.voteCategory);
      }
    });

    elements.customAssistantForm.addEventListener('submit', saveCustomAssistant);
    elements.assistantTestButton.addEventListener('click', testAssistant);
    elements.assistantRewriteButton.addEventListener('click', rewriteWithAssistant);
    elements.assistantDailyButton.addEventListener('click', loadDailyAssistant);
    elements.assistantName.addEventListener('input', () => {
      elements.customAssistantPreview.textContent = normalizeText(elements.assistantName.value).charAt(0).toUpperCase() || 'AI';
    });

    elements.chatForm.addEventListener('submit', sendChatMessage);
    elements.chatRefreshButton.addEventListener('click', () => loadChat());

    elements.groupCreateForm.addEventListener('submit', createGroup);
    elements.groupJoinForm.addEventListener('submit', joinGroup);
    elements.groupsRefreshButton.addEventListener('click', loadGroups);
    elements.groupEditForm.addEventListener('submit', updateGroup);
    elements.groupInviteForm.addEventListener('submit', inviteGroupUser);
    elements.groupMessageForm.addEventListener('submit', sendGroupMessage);
    elements.groupLeaveButton.addEventListener('click', leaveGroup);
    elements.groupDeleteButton.addEventListener('click', deleteGroup);

    elements.gameCreateForm.addEventListener('submit', createGameRoom);
    elements.gameJoinForm.addEventListener('submit', joinGameRoom);
    elements.gameReadyButton.addEventListener('click', toggleGameReady);
    elements.gameStartButton.addEventListener('click', startGame);
    elements.gameFinishButton.addEventListener('click', finishGame);
    elements.gameSubmissionForm.addEventListener('submit', submitGameIdea);
    elements.gameRefreshButton.addEventListener('click', pollGameNow);

    window.addEventListener('todoflow:session', () => {
      renderProfile();
      loadAssistant();
    });

    window.addEventListener('beforeunload', () => {
      stopChatPolling();
      stopGamePolling();
    });
  }

  bindEvents();
  renderProfile();

  if (getSession().accessToken) {
    loadAssistant();
  }
})();
