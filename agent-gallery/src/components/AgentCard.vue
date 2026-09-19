<script setup>
defineProps({
  agent: { type: Object, required: true }
});
</script>

<template>
  <article
    class="agent-card"
    :style="{ '--agent-color': agent.color }"
    tabindex="0"
  >
    <div class="card-top">
      <div class="agent-avatar">{{ agent.emoji }}</div>
      <div class="card-tags">
        <span class="tag cat-tag">{{ agent.categoryEmoji }} {{ agent.categoryName }}</span>
        <span v-if="agent.subCategory" class="tag sub-tag">{{ agent.subCategory }}</span>
      </div>
    </div>
    <h3 class="agent-name">{{ agent.name }}</h3>
    <p class="agent-desc">{{ agent.description || '暂无描述' }}</p>
    <div class="card-footer">
      <span class="view-hint">查看提示词</span>
      <span class="arrow">→</span>
    </div>
  </article>
</template>
