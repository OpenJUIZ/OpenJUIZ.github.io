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
		'/tutorial/quic-broker': '/tutorial/ipc-broker/',
		'/ja/tutorial/quic-broker': '/ja/tutorial/ipc-broker/',
		// 「演習」は「使ってみる」(/try/)にまとめた
		'/exercises': '/try/',
		'/exercises/slam': '/try/',
		'/exercises/slam/simulator': '/try/drive/',
		'/exercises/slam/mapping': '/try/mapping/',
		'/exercises/slam/check': '/try/check-map/',
		'/exercises/navigation': '/try/navigation/',
		'/exercises/navigation/stack': '/try/navigation/',
		'/exercises/navigation/own-map': '/try/own-map/',
		'/exercises/navigation/inside': '/try/inside/',
		'/ja/exercises': '/ja/try/',
		'/ja/exercises/slam': '/ja/try/',
		'/ja/exercises/slam/simulator': '/ja/try/drive/',
		'/ja/exercises/slam/mapping': '/ja/try/mapping/',
		'/ja/exercises/slam/check': '/ja/try/check-map/',
		'/ja/exercises/navigation': '/ja/try/navigation/',
		'/ja/exercises/navigation/stack': '/ja/try/navigation/',
		'/ja/exercises/navigation/own-map': '/ja/try/own-map/',
		'/ja/exercises/navigation/inside': '/ja/try/inside/',
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
			customCss: ['./src/styles/custom.css'],
			components: {
				// スマホ幅でもヘッダー右上に言語の切り替えを出す(site#72)
				Header: './src/components/Header.astro',
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
					label: 'Try it',
					translations: { ja: '使ってみる' },
					// 配布されている .juizapp をつないで、手で動かす → 地図を作る → 自律移動までを 1 本道で
					items: [{ autogenerate: { directory: 'try' } }],
				},
				{
					label: 'Tutorial',
					translations: { ja: 'チュートリアル' },
					// 第 1・2・4・5・6 章は言語ごとのページに分かれるので、章ごとのグループにする
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
							label: '4. Processes in separate processes',
							translations: { ja: '4. 別々のプロセスをつなぐ' },
							items: ['tutorial/multi-process', { autogenerate: { directory: 'tutorial/multi-process' } }],
						},
						{
							label: '5. Several libraries in one juiz',
							translations: { ja: '5. 1 つの juiz でつなぐ' },
							items: ['tutorial/connect', { autogenerate: { directory: 'tutorial/connect' } }],
						},
						{
							label: '6. Packaging as a Component',
							translations: { ja: '6. Component にまとめて配布する' },
							items: ['tutorial/component', { autogenerate: { directory: 'tutorial/component' } }],
						},
						'tutorial/ipc-broker',
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
				// juiz の使い方そのものではない、まわりの作業(SHA-256 の照合など)
				'tips',
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
