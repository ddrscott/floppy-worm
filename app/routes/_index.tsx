import type { MetaFunction } from '@remix-run/node';
import { ClientOnly } from '~/components/ClientOnly';
import { MainGame } from '~/components/MainGame';
import InstallButton from '~/components/InstallButton';

export const meta: MetaFunction = () => {
    return [
        { title: 'Floppy Worm' },
        { name: 'description', content: 'A physics-based worm game built with Phaser 3 and Matter.js' },
    ];
};

export default function Index() {
    return (
        <>
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
            <InstallButton />
        </>
    );
}
