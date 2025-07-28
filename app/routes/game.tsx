import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from '~/components/ClientOnly';
import { MainGame } from '~/components/MainGame';

export const meta: MetaFunction = () => {
    return [
        { title: 'Floppy Worm - Play' },
        { name: 'description', content: 'Play Floppy Worm in server mode' },
    ];
};

export default function GameRoute() {
    return (
        <ClientOnly
            fallback={
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: '#232333',
                    color: 'white'
                }}>
                    Loading Floppy Worm...
                </div>
            }
        >
            <MainGame />
        </ClientOnly>
    );
}