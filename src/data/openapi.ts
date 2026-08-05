export const openapiSpec = {
  "openapi": "3.1.0",
  "info": {
    "title": "GurkyPay Core Engine API",
    "description": "Unified and version-stabilized API contract for Website, Android, and Admin CMS applications. All endpoints are secured under standard error formats and Sanctum authentication.",
    "version": "1.0.0",
    "contact": {
      "name": "GurkyPay Engineering Team",
      "email": "dechaprio31@gmail.com"
    }
  },
  "servers": [
    {
      "url": "/api",
      "description": "Primary Platform Gate"
    }
  ],
  "components": {
    "securitySchemes": {
      "SanctumBearer": {
        "type": "http",
        "scheme": "bearer",
        "description": "Enter your Laravel Sanctum token generated from login endpoint."
      }
    },
    "schemas": {
      "StandardResponse": {
        "type": "object",
        "required": ["success", "message", "data", "meta", "errors"],
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "message": {
            "type": "string",
            "example": "Request completed successfully."
          },
          "data": {
            "type": "object",
            "nullable": true,
            "example": null
          },
          "meta": {
            "type": "object",
            "nullable": true,
            "example": null
          },
          "errors": {
            "type": "object",
            "nullable": true,
            "example": null
          }
        }
      },
      "ErrorResponse": {
        "type": "object",
        "required": ["success", "message", "data", "meta", "errors"],
        "properties": {
          "success": {
            "type": "boolean",
            "example": false
          },
          "message": {
            "type": "string",
            "example": "Validation or authentication failed."
          },
          "data": {
            "type": "object",
            "nullable": true,
            "example": null
          },
          "meta": {
            "type": "object",
            "nullable": true,
            "example": null
          },
          "errors": {
            "type": "object",
            "nullable": true,
            "example": {
              "field": ["The selected field is invalid."]
            }
          }
        }
      }
    }
  },
  "paths": {
    "/health": {
      "get": {
        "summary": "Platform Health Probe",
        "description": "Verifies availability of databases, caching systems, and background workers.",
        "tags": ["Observability & Health"],
        "responses": {
          "200": {
            "description": "System UP and healthy.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/status": {
      "get": {
        "summary": "Platform Version & Environment",
        "description": "Retrieves PHP version, framework version, timezone, and request tracing settings.",
        "tags": ["Observability & Health"],
        "responses": {
          "200": {
            "description": "System metadata.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/metrics": {
      "get": {
        "summary": "Dashboard Monitoring Metrics",
        "description": "Calculates queue statistics, success rates (Digiflazz, Midtrans), daily transactions, and revenue.",
        "tags": ["Observability & Health"],
        "responses": {
          "200": {
            "description": "Metrics analytics data.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/auth/register": {
      "post": {
        "summary": "User Registration",
        "description": "Creates a new user profile and automatically provisions a digital wallet ecosystem.",
        "tags": ["Authentication"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["name", "email", "phone_number", "password", "password_confirmation"],
                "properties": {
                  "name": { "type": "string", "example": "Ahmad Dani" },
                  "email": { "type": "string", "example": "ahmad.dani@example.com" },
                  "phone_number": { "type": "string", "example": "081234567890" },
                  "password": { "type": "string", "example": "securePassword123" },
                  "password_confirmation": { "type": "string", "example": "securePassword123" }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "User successfully registered.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          },
          "422": {
            "description": "Validation failed.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/auth/login": {
      "post": {
        "summary": "User Login",
        "description": "Authenticates credentials and returns a Bearer token for access to protected resources.",
        "tags": ["Authentication"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["phone_or_email", "password"],
                "properties": {
                  "phone_or_email": { "type": "string", "example": "ahmad.dani@example.com" },
                  "password": { "type": "string", "example": "securePassword123" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Login successful.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          },
          "401": {
            "description": "Invalid credentials.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/auth/me": {
      "get": {
        "summary": "Get Profile",
        "description": "Retrieves the logged-in user profile, wallet information, and transaction flags.",
        "tags": ["Authentication"],
        "security": [{ "SanctumBearer": [] }],
        "responses": {
          "200": {
            "description": "Profile details.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/wallet": {
      "get": {
        "summary": "Wallet Balance & Details",
        "description": "Retrieves the active balance, wallet card number, and current account status.",
        "tags": ["Wallet & Financials"],
        "security": [{ "SanctumBearer": [] }],
        "responses": {
          "200": {
            "description": "Wallet status.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/wallet/topup": {
      "post": {
        "summary": "Initiate Wallet Top-Up",
        "description": "Prepares a top-up request and contacts Midtrans for snap_token and payment URL generation.",
        "tags": ["Wallet & Financials"],
        "security": [{ "SanctumBearer": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["amount"],
                "properties": {
                  "amount": { "type": "number", "example": 50000.00 }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Top-up initiated.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/wallet/transfer": {
      "post": {
        "summary": "Wallet-to-Wallet Transfer",
        "description": "Instantly transfers funds to another registered wallet. Demands validation of recipient and PIN code.",
        "tags": ["Wallet & Financials"],
        "security": [{ "SanctumBearer": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["recipient_wallet_number", "amount", "pin"],
                "properties": {
                  "recipient_wallet_number": { "type": "string", "example": "104200000003" },
                  "amount": { "type": "number", "example": 25000.00 },
                  "pin": { "type": "string", "example": "123456", "description": "6-digit transaction PIN. Server ignores client status/admin_fee." }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Transfer completed successfully.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          },
          "422": {
            "description": "Insufficient balance or incorrect PIN.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/categories": {
      "get": {
        "summary": "List PPOB Categories",
        "description": "Provides all categories of mobile and utility products, such as Pulsa, Paket Data, Token PLN, etc.",
        "tags": ["Products & PPOB"],
        "responses": {
          "200": {
            "description": "List of categories.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/products": {
      "get": {
        "summary": "List Active Products",
        "description": "Lists active PPOB items with pricing, description, SKU, and categories.",
        "tags": ["Products & PPOB"],
        "parameters": [
          { "name": "category", "in": "query", "required": false, "schema": { "type": "string" } },
          { "name": "provider", "in": "query", "required": false, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": {
            "description": "List of products.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    },
    "/v1/transactions": {
      "get": {
        "summary": "List Past Transactions",
        "description": "Fetches historical lists of orders and invoices for the authenticated user.",
        "tags": ["Transactions & Invoices"],
        "security": [{ "SanctumBearer": [] }],
        "responses": {
          "200": {
            "description": "Transaction list.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      },
      "post": {
        "summary": "Checkout PPOB Order",
        "description": "Deducts money from balance, books PPOB purchase, and relays execution to Digiflazz providers.",
        "tags": ["Transactions & Invoices"],
        "security": [{ "SanctumBearer": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["sku_code", "target_number", "pin"],
                "properties": {
                  "sku_code": { "type": "string", "example": "tsel10000" },
                  "target_number": { "type": "string", "example": "081234567890" },
                  "pin": { "type": "string", "example": "123456", "description": "6-digit transaction PIN. Do not send status or admin_fee — server calculates pricing and always starts as pending." }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Checkout registered.",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/StandardResponse" }
              }
            }
          }
        }
      }
    }
  }
};
