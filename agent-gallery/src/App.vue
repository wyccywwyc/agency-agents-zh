<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import data from './data/index.json';
import AgentCard from './components/AgentCard.vue';
import AgentDetail from './components/AgentDetail.vue';

const agents = data.agents;
const categories = data.categories;
const total = data.total;

const search = ref('');
const activeCategory = ref('all');
const routeId = ref(null);
const searchInput = ref(null);

/* ---------- hash 路由：#/ 列表，#/agent/<id> 详情 ---------- */
function parseHash() {
  const hash = window.location.hash.replace(/^#/, '');
  const m = hash.match(/^\/agent\/(.+)$/);
  routeId.value = m ? decodeURIComponent(m[1]) : null;
}

function openAgent(agent) {
  window.location.hash = `/agent/${encodeURIComponent(agent.id)}`;
}

function backToList() {
  window.location.hash = '/';
}

/* ---------- 筛选与搜索 ---------- */
const filteredAgents = computed(() => {
  const kw = search.value.trim().toLowerCase();
  return agents.filter((a) => {
    if (activeCategory.value !== 'all' && a.category !== activeCategory.value) return false;
    if (!kw) return true;
    return (
      a.name.toLowerCase().includes(kw) ||
      (a.description || '').toLowerCase().includes(kw) ||
      a.id.toLowerCase().includes(kw) ||
      a.categoryName.toLowerCase().includes(kw)
    );
  });
});

const activeAgent = computed(() =>
  routeId.value ? agents.find((a) => a.id === routeId.value) : null
);

const activeCategoryName = computed(() => {
  if (activeCategory.value === 'all') return '全部智能体';
  return categories.find((c) => c.id === activeCategory.value)?.name || '';
});

function selectCategory(id) {
  activeCategory.value = id;
}

function clearFilters() {
  search.value = '';
  activeCategory.value = 'all';
}

/* 快捷键：/ 聚焦搜索，Esc 清空（列表态） */
function onGlobalKeydown(e) {
  if (routeId.value) return;
  if (e.key === '/' && document.activeElement !== searchInput.value) {
    e.preventDefault();
    searchInput.value?.focus();
  } else if (e.key === 'Escape' && document.activeElement === searchInput.value) {
    search.value = '';
    searchInput.value?.blur();
  }
}

onMounted(() => {
  parseHash();
  window.addEventListener('hashchange', parseHash);
  window.addEventListener('keydown', onGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', parseHash);
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <div class="app" :class="{ 'is-detail': !!activeAgent }">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="logo" @click="backToList">
        <span class="logo-emoji">🤖</span>
        <div class="logo-text">
          <strong>Agency Agents</strong>
          <small>智能体展览馆</small>
        </div>
      </div>

      <nav class="category-nav">
        <button
          class="cat-item"
          :class="{ active: activeCategory === 'all' }"
          @click="selectCategory('all')"
        >
          <span class="cat-emoji">🏛️</span>
          <span class="cat-name">全部</span>
          <span class="cat-count">{{ total }}</span>
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          class="cat-item"
          :class="{ active: activeCategory === c.id }"
          @click="selectCategory(c.id)"
        >
          <span class="cat-emoji">{{ c.emoji }}</span>
          <span class="cat-name">{{ c.name }}</span>
          <span class="cat-count">{{ c.count }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
    共 {{ total }} 个智能体 · {{ categories.length }} 个分类
      </div>
    </aside>

    <!-- 主区域 -->
    <main class="main">
      <!-- 列表视图 -->
      <div v-show="!activeAgent" class="list-view">
        <header class="topbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              ref="searchInput"
              v-model="search"
              type="text"
              placeholder="搜索智能体名称、描述、文件路径…"
            />
            <kbd v-if="!search" class="search-kbd">/</kbd>
            <button v-if="search" class="search-clear" @click="search = ''">✕</button>
          </div>
        </header>

        <!-- 移动端横向分类 -->
        <div class="chip-row">
          <button
            class="chip"
            :class="{ active: activeCategory === 'all' }"
            @click="selectCategory('all')"
          >
            🏛️ 全部 <em>{{ total }}</em>
          </button>
          <button
            v-for="c in categories"
            :key="c.id"
            class="chip"
            :class="{ active: activeCategory === c.id }"
            @click="selectCategory(c.id)"
          >
            {{ c.emoji }} {{ c.name }} <em>{{ c.count }}</em>
          </button>
        </div>

        <div class="list-header">
          <h2>
            {{ activeCategoryName }}
            <span class="result-count">{{ filteredAgents.length }}</span>
          </h2>
          <button
            v-if="search || activeCategory !== 'all'"
            class="btn ghost clear-btn"
            @click="clearFilters"
          >
            清除筛选
          </button>
        </div>

        <div v-if="filteredAgents.length" class="card-grid">
          <AgentCard
            v-for="agent in filteredAgents"
            :key="agent.id"
            :agent="agent"
            @click="openAgent(agent)"
            @keydown.enter="openAgent(agent)"
          />
        </div>
        <div v-else class="empty-state">
          <div class="empty-emoji">🫥</div>
          <p>没有找到匹配的智能体</p>
          <button class="btn primary" @click="clearFilters">清除筛选条件</button>
        </div>
      </div>

      <!-- 详情视图 -->
      <AgentDetail v-if="activeAgent" :agent="activeAgent" @back="backToList" />
    </main>
  </div>
</template>
