import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '../openapi/openapi.document.ts';
import { HTTP_STATUS } from '../../../shared/constants/http-status.constants.ts';

const documentationRouter = Router();

// Montadas bajo /auth por la misma razón que en ms-employees: el Gateway proxea /auth/*
// preservando la ruta, así que /auth/docs y /auth/openapi.json quedan alcanzables en
// http://localhost:8080 sin reescritura.
documentationRouter.get('/auth/openapi.json', (_req, res) => {
  res.status(HTTP_STATUS.OK).json(openApiDocument);
});

documentationRouter.use(
  '/auth/docs',
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'Auth API | Swagger UI',
    swaggerOptions: {
      displayRequestDuration: true,
      filter: true,
      persistAuthorization: true,
    },
  }),
);

export default documentationRouter;
