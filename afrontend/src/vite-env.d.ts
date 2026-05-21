/// <reference types="vite/client" />

declare module '@assets/*' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

declare module 'firebase/messaging' {
  export function getMessaging(app?: any): any;
  export function getToken(messaging: any, options?: any): Promise<string>;
  export function onMessage(messaging: any, nextOrObserver: any): any;
  export interface Messaging {
    [key: string]: any;
  }
}

