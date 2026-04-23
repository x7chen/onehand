import { createRouter, createWebHashHistory } from 'vue-router'
import UnifiedView from '../views/UnifiedView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'unified',
      component: UnifiedView
    },
    {
      path: '/multi-chat/:notebookId',
      name: 'multi-chat',
      component: UnifiedView
    },
    {
      path: '/pdf/:notebookId',
      name: 'pdf',
      component: UnifiedView
    }
  ]
})

export default router