import { useEffect, useSyncExternalStore } from 'react';
import { fullSync, getSyncState, subscribeSyncState } from '../sync';

export const useSyncState = () =>
    useSyncExternalStore(subscribeSyncState, getSyncState);

// 앱 루트에서 1회 호출: 시작/온라인 복귀/탭 포커스 복귀 시 동기화
export const useSyncTriggers = () => {
    useEffect(() => {
        fullSync();
        const onOnline = () => fullSync();
        const onVisible = () => {
            if (document.visibilityState === 'visible') fullSync();
        };
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);
};
