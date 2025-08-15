import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import path from 'path'
import fs from 'fs'

const router = Router()

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '../../docs/openapi.yaml')
let swaggerDocument: any

try {
  if (fs.existsSync(openApiPath)) {
    swaggerDocument = YAML.load(openApiPath)
  } else {
    // Fallback inline specification if file doesn't exist
    swaggerDocument = {
      openapi: '3.0.3',
      info: {
        title: 'GlobalLand API',
        description: 'Real Estate Tokenization Platform API',
        version: '1.0.0'
      },
      servers: [
        {
          url: '/api',
          description: 'API Server'
        }
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'API is healthy'
              }
            }
          }
        }
      }
    }
  }
} catch (error) {
  console.error('Error loading OpenAPI specification:', error)
  swaggerDocument = {
    openapi: '3.0.3',
    info: {
      title: 'GlobalLand API',
      description: 'API documentation could not be loaded',
      version: '1.0.0'
    }
  }
}

// Swagger UI options
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // Add authorization header if available
      const token = localStorage.getItem('authToken')
      if (token) {
        req.headers.Authorization = `Bearer ${token}`
      }
      return req
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #2c5aa0 }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 15px; border-radius: 5px; margin-bottom: 20px }
  `,
  customSiteTitle: 'GlobalLand API Documentation',
  customfavIcon: '/favicon.ico'
}

// Serve Swagger UI
router.use('/', swaggerUi.serve)
router.get('/', swaggerUi.setup(swaggerDocument, swaggerOptions))

// Serve raw OpenAPI spec
router.get('/openapi.yaml', (req, res) => {
  res.setHeader('Content-Type', 'application/x-yaml')
  if (fs.existsSync(openApiPath)) {
    res.sendFile(openApiPath)
  } else {
    res.status(404).json({
      success: false,
      error: 'OpenAPI specification not found'
    })
  }
})

router.get('/openapi.json', (req, res) => {
  res.json(swaggerDocument)
})

// API documentation landing page
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'GlobalLand API Documentation',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the GlobalLand real estate tokenization platform',
      links: {
        interactive: '/api/docs',
        openapi_yaml: '/api/docs/openapi.yaml',
        openapi_json: '/api/docs/openapi.json',
        postman: '/api/docs/postman'
      },
      authentication: {
        type: 'Bearer Token (JWT)',
        header: 'Authorization: Bearer <token>',
        loginEndpoint: '/api/auth/login'
      },
      support: {
        email: 'support@globalland.com',
        documentation: 'https://docs.globalland.com',
        github: 'https://github.com/globalland/api'
      }
    }
  })
})

// Postman collection endpoint
router.get('/postman', (req, res) => {
  const postmanCollection = {
    info: {
      name: 'GlobalLand API',
      description: 'Real Estate Tokenization Platform API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{authToken}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'https://api.globalland.com/api',
        type: 'string'
      },
      {
        key: 'authToken',
        value: '',
        type: 'string'
      }
    ],
    item: [
      {
        name: 'Authentication',
        item: [
          {
            name: 'Login',
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  email: 'user@example.com',
                  password: 'password123'
                })
              },
              url: {
                raw: '{{baseUrl}}/auth/login',
                host: ['{{baseUrl}}'],
                path: ['auth', 'login']
              }
            }
          },
          {
            name: 'Register',
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  email: 'newuser@example.com',
                  password: 'password123',
                  firstName: 'John',
                  lastName: 'Doe'
                })
              },
              url: {
                raw: '{{baseUrl}}/auth/register',
                host: ['{{baseUrl}}'],
                path: ['auth', 'register']
              }
            }
          }
        ]
      },
      {
        name: 'Properties',
        item: [
          {
            name: 'Get All Properties',
            request: {
              method: 'GET',
              url: {
                raw: '{{baseUrl}}/properties?page=1&limit=20',
                host: ['{{baseUrl}}'],
                path: ['properties'],
                query: [
                  {
                    key: 'page',
                    value: '1'
                  },
                  {
                    key: 'limit',
                    value: '20'
                  }
                ]
              }
            }
          },
          {
            name: 'Get Property Details',
            request: {
              method: 'GET',
              url: {
                raw: '{{baseUrl}}/properties/{{propertyId}}',
                host: ['{{baseUrl}}'],
                path: ['properties', '{{propertyId}}']
              }
            }
          }
        ]
      },
      {
        name: 'Investments',
        item: [
          {
            name: 'Get Portfolio',
            request: {
              method: 'GET',
              header: [
                {
                  key: 'Authorization',
                  value: 'Bearer {{authToken}}'
                }
              ],
              url: {
                raw: '{{baseUrl}}/investments/portfolio',
                host: ['{{baseUrl}}'],
                path: ['investments', 'portfolio']
              }
            }
          },
          {
            name: 'Purchase Investment',
            request: {
              method: 'POST',
              header: [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                },
                {
                  key: 'Authorization',
                  value: 'Bearer {{authToken}}'
                }
              ],
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  propertyId: '{{propertyId}}',
                  tokenAmount: 50,
                  paymentMethod: 'STRIPE',
                  paymentMethodId: 'pm_test_123'
                })
              },
              url: {
                raw: '{{baseUrl}}/investments/purchase',
                host: ['{{baseUrl}}'],
                path: ['investments', 'purchase']
              }
            }
          }
        ]
      }
    ]
  }

  res.json(postmanCollection)
})

export default router