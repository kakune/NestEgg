import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);
  }),
  // Add a mock for the root API endpoint as well, to avoid breaking existing App.tsx
  http.get('/api', () => {
    return HttpResponse.text('Hello from MSW! (Mocked Backend)');
  }),
];
