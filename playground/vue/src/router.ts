import { createRouter, createWebHistory } from 'vue-router'
import DetailsView from './views/DetailsView.vue'
import HomeView from './views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/details', name: 'details', component: DetailsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
