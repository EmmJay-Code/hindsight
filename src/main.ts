import './styles.css';
import { Store } from './store.ts';
import { createApp } from './app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app not found');

const store = new Store();
createApp(store, root);
