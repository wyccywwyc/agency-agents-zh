<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { renderMarkdown } from '../lib/markdown.js';

// 提示词按需加载：每个智能体一个 JSON 分片，点开详情时才请求
const promptLoaders = import.meta.glob('../data/prompts/*.json');

const props = defineProps({
  agent: { type: Object, required: true }
});
const emit = defineEmits(['back']);

const showRaw = ref(false);
const copied = ref(false);
const bodyRef = ref(null);
const content = ref('');
const loading = ref(true);
const loadError = ref(false);

const renderedHtml = computed(() => renderMarkdown(content.value));
const wordCount = computed(() => content.value.length);

async function loadPrompt() {
  loading.value = true;
  loadError.value = false;
  showRaw.value = false;
  const loader = promptLoaders[`../data/prompts/${props.agent.slug}.json`];
  if (!loader) {
    loadError.value = true;
    loading.value = false;
    return;
  }
  try {
    const mod = await loader();
    content.value = mod.default.content;
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

async function copyPrompt() {
  const text = content.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 非安全上下文（http 非 localhost 等）下的兜底
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1800);
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('back');
}

watch(
  () => props.agent.id,
  async () => {
    copied.value = false;
    await nextTick();
    bodyRef.value?.scrollTo({ top: 0 });
    loadPrompt();
  },
  { immediate: true }
);
</script>

<template>
  <section
    class="detail"
    :style="{ '--agent-color': agent.color }"
    tabindex="0"
    @keydown="onKeydown"
  >
    <header class="detail-header">
      <button class="btn ghost back-btn" @click="emit('back')">
        <span>←</span> 返回列表
      </button>
      <div class="detail-actions">
        <template v-if="!loading && !loadError">
          <button
            class="btn ghost toggle-btn"
            :class="{ active: !showRaw }"
            @click="showRaw = false"
          >
            预览
          </button>
          <button
            class="btn ghost toggle-btn"
            :class="{ active: showRaw }"
            @click="showRaw = true"
          >
            Markdown 源码
          </button>
          <button class="btn primary copy-btn" :class="{ copied }" @click="copyPrompt">
            {{ copied ? '✓ 已复制' : '📋 复制提示词' }}
          </button>
        </template>
      </div>
    </header>

    <div ref="bodyRef" class="detail-body">
      <div class="detail-title-block">
        <div class="detail-avatar">{{ agent.emoji }}</div>
        <div class="detail-title-text">
          <h1>{{ agent.name }}</h1>
          <p class="detail-desc">{{ agent.description || '暂无描述' }}</p>
          <div class="detail-meta">
            <span class="tag cat-tag">{{ agent.categoryEmoji }} {{ agent.categoryName }}</span>
            <span v-if="agent.subCategory" class="tag sub-tag">{{ agent.subCategory }}</span>
            <code class="path-tag">{{ agent.path }}</code>
            <span v-if="!loading && !loadError" class="word-count">
              {{ wordCount.toLocaleString() }} 字符
            </span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="prompt-state">
        <div class="spinner"></div>
        <p>正在加载提示词…</p>
      </div>
      <div v-else-if="loadError" class="prompt-state">
        <div class="state-emoji">⚠️</div>
        <p>提示词加载失败，请稍后重试</p>
        <button class="btn primary" @click="loadPrompt">重新加载</button>
      </div>
      <template v-else>
        <div v-if="!showRaw" class="markdown-body" v-html="renderedHtml"></div>
        <pre v-else class="raw-prompt">{{ content }}</pre>
      </template>
    </div>
  </section>
</template>
