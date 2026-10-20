import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { GoogleAuthService } from './google-auth.service';
import { from, switchMap } from 'rxjs';

const GOOGLE_API = 'https://www.googleapis.com/';

export const googleAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(GOOGLE_API)) {
    return next(request);
  }

  const auth = inject(GoogleAuthService);

  // getAccessToken: transforma em Observable
  // switchMap: Só envia a requisição depois que o token é obtido
  return from(auth.getAccessToken()).pipe(
    switchMap((token) => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
};
