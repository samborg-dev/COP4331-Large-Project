import { env } from '../env';

// e.g. buildPath('api/login') -> http://localhost:5000/api/login
export function buildPath(route:string) : string
{
    return env.VITE_API_URL.replace(/\/$/, '') + '/' + route;
}
