// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://openjuiz.github.io',
	// 英語版は以前 /en/ にあったので、古いリンクをルートへ転送する
	redirects: {
		'/en': '/',
		'/en/getting-started/install': '/getting-started/install/',
		'/en/getting-started/quickstart': '/getting-started/quickstart/',
		'/en/concepts/overview': '/concepts/overview/',
	},
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
					items: [
						'getting-started/install',
						'getting-started/packages',
						{
							label: 'Quick start',
							translations: { ja: 'クイックスタート' },
							items: [
								'getting-started/quickstart',
								{ autogenerate: { directory: 'getting-started/quickstart' } },
							],
						},
					],
				},
				{
					label: 'Tutorial',
					translations: { ja: 'チュートリアル' },
					// 第 1・2・4・5 章は言語ごとのページに分かれるので、章ごとのグループにする
					items: [
						'tutorial',
						{
							label: '1. Your first Process',
							translations: { ja: '1. はじめての Process' },
							items: ['tutorial/first-process', { autogenerate: { directory: 'tutorial/first-process' } }],
						},
						{
							label: '2. Keeping state',
							translations: { ja: '2. 状態を持つ' },
							items: ['tutorial/container', { autogenerate: { directory: 'tutorial/container' } }],
						},
						'tutorial/config-file',
						{
							label: '4. Connecting Processes',
							translations: { ja: '4. Process をつなぐ' },
							items: ['tutorial/connect', { autogenerate: { directory: 'tutorial/connect' } }],
						},
						{
							label: '5. Packaging as a Component',
							translations: { ja: '5. Component にまとめて配布する' },
							items: ['tutorial/component', { autogenerate: { directory: 'tutorial/component' } }],
						},
						'tutorial/multi-process',
						'tutorial/quic-broker',
						'tutorial/datatype',
					],
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
