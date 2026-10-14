// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://openjuiz.github.io',
	integrations: [
		starlight({
			title: 'juiz',
			description: 'Distributed middleware for robots and IoT',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				alt: 'juiz',
				replacesTitle: true,
			},
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				ja: { label: '日本語', lang: 'ja' },
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/OpenJUIZ/juiz' },
			],
			editLink: {
				baseUrl: 'https://github.com/OpenJUIZ/OpenJUIZ.github.io/edit/main/',
			},
			sidebar: [
				{
					label: 'Getting Started',
					translations: { ja: 'はじめに' },
					items: [{ autogenerate: { directory: 'getting-started' } }],
				},
				{
					label: 'Tutorial',
					translations: { ja: 'チュートリアル' },
					items: [{ autogenerate: { directory: 'tutorial' } }],
				},
				{
					label: 'Concepts',
					translations: { ja: 'コンセプト' },
					items: [{ autogenerate: { directory: 'concepts' } }],
				},
				{
					label: 'Guides',
					translations: { ja: 'ガイド' },
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Links',
					translations: { ja: 'リンク' },
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
