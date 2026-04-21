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
      path: '/home',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/canvas/:notebookId',
      name: 'canvas',
      component: () => import('../views/CanvasView.vue')
    },
    {
      path: '/pdf/:notebookId',
      name: 'pdf',
      component: () => import('../views/PdfReaderView.vue')
    },
    {
      path: '/multi-chat/:notebookId',
      name: 'multi-chat',
      component: () => import('../views/MultiChatView.vue')
    }
  ]
})

export default router