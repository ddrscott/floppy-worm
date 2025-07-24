import type { LinksFunction, MetaFunction } from '@remix-run/node';
import App from '../app.client';

export const links: LinksFunction = () => {
    return [
        {
            rel: 'stylesheet',
            href: '/tailwind.css',
        }
    ]
}

export const meta: MetaFunction = () => {
    return [
        { title: 'Floppy Worm' },
        { name: 'description', content: 'A physics-based worm game built with Phaser 3 and Matter.js' },
    ];
};

export default function Index() {
    return (
        <App />
    );
}
