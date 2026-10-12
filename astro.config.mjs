// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://openjuiz.github.io',
	integrations: [
		starlight({
			title: 'juiz',
			description: 'ロボットと IoT のための分散ミドルウェア',
			defaultLocale: 'root',
			locales: {
				root: { label: '日本語', lang: 'ja' },
				en: { label: 'English', lang: 'en' },
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/OpenJUIZ/juiz' },
			],
			editLink: {
				baseUrl: 'https://github.com/OpenJUIZ/OpenJUIZ.github.io/edit/main/',
			},
			sidebar: [
				{
					label: 'はじめに',
					translations: { en: 'Getting Started' },
					items: [{ autogenerate: { directory: 'getting-started' } }],
				},
				{
					label: 'コンセプト',
					translations: { en: 'Concepts' },
					items: [{ autogenerate: { directory: 'concepts' } }],
				},
				{
					label: 'ガイド',
					translations: { en: 'Guides' },
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'リンク',
					translations: { en: 'Links' },
					items: [
						{ label: 'GitHub (juiz)', link: 'https://github.com/OpenJUIZ/juiz' },
						{ label: 'juiz_sdk (docs.rs)', link: 'https://docs.rs/juiz_sdk' },
						{ label: 'juiz_app (crates.io)', link: 'https://crates.io/crates/juiz_app' },
						{ label: 'pyjuiz (PyPI)', link: 'https://pypi.org/project/pyjuiz/' },
					],
				},
			],
		}),
	],
});
