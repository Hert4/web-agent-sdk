<script setup lang="ts">
import AgentChat from './components/AgentChat.vue'
</script>

<template>
	<div class="select-none font-Manrope">
		<router-view></router-view>
		<AgentChat />
	</div>
</template>
