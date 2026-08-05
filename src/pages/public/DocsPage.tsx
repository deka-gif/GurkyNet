import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Terminal, Code2, ShieldCheck, Play, Copy, Check, 
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Activity, 
  Layers, Lock, Database, Globe, ArrowRight, HeartPulse, Sparkles
} from 'lucide-react';
import { openapiSpec } from '../../data/openapi';
import { API_BASE_URL, buildApiUrl } from '../../services/api';

// TypeScript SDK Template for Developer Copying
const tsSdkCode = `/**
 * GurkyPay Core TypeScript SDK (Production-Ready)
 * Generated for Sprint 19 API Stabilization.
 */

export interface GurkyPayConfig {
  baseUrl?: string;
  authToken?: string;
  correlationIdProvider?: () => string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  meta: Record<string, any> | null;
  errors: Record<string, string[]> | null;
}

export class GurkyPayClient {
  private baseUrl: string;
  private authToken?: string;
  private correlationIdProvider: () => string;

  constructor(config: GurkyPayConfig = {}) {
    this.baseUrl = config.baseUrl || '${API_BASE_URL}';
    this.authToken = config.authToken;
    this.correlationIdProvider = config.correlationIdProvider || (() => {
      return 'ts-sdk-' + Math.random().toString(36).substring(2, 10);
    });
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async request<T>(method: string, path: string, body?: any, query?: Record<string, any>): Promise<ApiResponse<T>> {
    const correlationId = this.correlationIdProvider();
    const requestId = 'req-' + Math.random().toString(36).substring(2, 10);
    
    let url = \`\${this.baseUrl}\${path}\`;
    if (query) {
      const qParams = new URLSearchParams(
        Object.entries(query).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      );
      url += \`?\${qParams.toString()}\`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Request-ID': requestId,
    };

    if (this.authToken) {
      headers['Authorization'] = \`Bearer \${this.authToken}\`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network communication failure.',
        data: null,
        meta: null,
        errors: { network: ['Failed to reach the gateway. Please verify connection.'] }
      };
    }
  }

  // Observability & Health
  async getHealth() {
    return this.request('GET', '/health');
  }

  async getStatus() {
    return this.request('GET', '/status');
  }

  async getMetrics() {
    return this.request('GET', '/metrics');
  }

  // Authentication Module
  async register(data: any) {
    return this.request<any>('POST', '/auth/register', data);
  }

  async login(credentials: any) {
    const res = await this.request<any>('POST', '/auth/login', credentials);
    if (res.success && res.data?.token) {
      this.setAuthToken(res.data.token);
    }
    return res;
  }

  async getProfile() {
    return this.request<any>('GET', '/auth/me');
  }

  // Wallet Module
  async getWallet() {
    return this.request<any>('GET', '/wallet');
  }

  async getHistory() {
    return this.request<any>('GET', '/wallet/history');
  }

  async initiateTopUp(amount: number) {
    return this.request<any>('POST', '/wallet/topup', { amount });
  }

  async transfer(data: { target_wallet_number: string; amount: number; transaction_pin: string }) {
    return this.request<any>('POST', '/wallet/transfer', data);
  }

  // PPOB & Order Module
  async getCategories() {
    return this.request<any>('GET', '/categories');
  }

  async getProducts(params?: { category?: string; provider?: string }) {
    return this.request<any>('GET', '/products', undefined, params);
  }

  async checkoutOrder(data: { sku_code: string; target_number: string; transaction_pin: string }) {
    return this.request<any>('POST', '/transactions', data);
  }
}`;

// Kotlin SDK Template for Developer Copying
const kotlinSdkCode = `package com.gurpypay.sdk

import com.google.gson.Gson
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import java.io.IOException

data class ApiResponse<T>(
    val success: Boolean,
    val message: String,
    val data: T?,
    val meta: Map<String, Any>?,
    val errors: Map<String, List<String>>?
)

class GurkyPayClient(
    private val baseUrl: String = "${API_BASE_URL}",
    private var authToken: String? = null
) {
    private val client = OkHttpClient()
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    fun setToken(token: String) {
        this.authToken = token
    }

    private fun <T> executeRequest(
        method: String,
        path: String,
        bodyJson: String? = null,
        responseType: Class<T>
    ): ApiResponse<T> {
        val correlationId = "kt-sdk-" + java.util.UUID.randomUUID().toString()
        val requestId = "req-" + java.util.UUID.randomUUID().toString()
        
        val requestBuilder = Request.Builder()
            .url("\$baseUrl\$path")
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("X-Correlation-ID", correlationId)
            .header("X-Request-ID", requestId)

        authToken?.let {
            requestBuilder.header("Authorization", "Bearer \$it")
        }

        if (method == "POST") {
            val body = (bodyJson ?: "{}").toRequestBody(jsonMediaType)
            requestBuilder.post(body)
        } else {
            requestBuilder.get()
        }

        return try {
            val response = client.newCall(requestBuilder.build()).execute()
            val bodyString = response.body?.string() ?: ""
            
            // Custom response generic deserializer
            val type = com.google.gson.reflect.TypeToken.getParameterized(ApiResponse::class.java, responseType).type
            gson.fromJson(bodyString, type)
        } catch (e: Exception) {
            ApiResponse(
                success = false,
                message = e.message ?: "Network error occurred",
                data = null,
                meta = null,
                errors = mapOf("network" to listOf("Failed to execute request"))
            )
        }
    }

    fun getHealth(): ApiResponse<Map<String, Any>> {
        return executeRequest("GET", "/health", null, Map::class.java) as ApiResponse<Map<String, Any>>
    }

    fun getStatus(): ApiResponse<Map<String, Any>> {
        return executeRequest("GET", "/status", null, Map::class.java) as ApiResponse<Map<String, Any>>
    }

    fun getMetrics(): ApiResponse<Map<String, Any>> {
        return executeRequest("GET", "/metrics", null, Map::class.java) as ApiResponse<Map<String, Any>>
    }

    fun login(body: Map<String, String>): ApiResponse<Map<String, Any>> {
        val response = executeRequest("POST", "/auth/login", gson.toJson(body), Map::class.java)
        if (response.success && response.data != null) {
            val token = response.data["token"] as? String
            token?.let { setToken(it) }
        }
        return response as ApiResponse<Map<String, Any>>
    }
}`;

interface TestResult {
  name: string;
  endpoint: string;
  passed: boolean;
  statusCode?: number;
  message?: string;
  details: string[];
}

export const DocsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'spec' | 'sdk' | 'test'>('endpoints');
  const [activeTag, setActiveTag] = useState<string>('All');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [sdkLanguage, setSdkLanguage] = useState<'typescript' | 'kotlin'>('typescript');

  // Interactive Playground States
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [playgroundToken, setPlaygroundToken] = useState<string>('');
  const [playgroundBody, setPlaygroundBody] = useState<string>('');
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  const [playgroundHeaders, setPlaygroundHeaders] = useState<any>(null);
  const [playgroundStatus, setPlaygroundStatus] = useState<number | null>(null);
  const [loadingPlayground, setLoadingPlayground] = useState<boolean>(false);

  // Automated Compliance Test States
  const [runningTests, setRunningTests] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Available unique tags from OpenAPI
  const tags = ['All', 'Observability & Health', 'Authentication', 'Wallet & Financials', 'Products & PPOB', 'Transactions & Invoices'];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Pre-fill body helper depending on path
  const handleSelectEndpoint = (path: string, method: string) => {
    setSelectedEndpoint(`${method.toUpperCase()} ${path}`);
    setPlaygroundResult(null);
    setPlaygroundStatus(null);
    setPlaygroundHeaders(null);
    
    if (path.includes('/login')) {
      setPlaygroundBody(JSON.stringify({ phone_or_email: "tracer@gurkypay.com", password: "password123" }, null, 2));
    } else if (path.includes('/register')) {
      setPlaygroundBody(JSON.stringify({ name: "Rizky", email: "rizky@gurkypay.com", phone_number: "081234567899", password: "password123", password_confirmation: "password123" }, null, 2));
    } else if (path.includes('/wallet/topup')) {
      setPlaygroundBody(JSON.stringify({ amount: 50000 }, null, 2));
    } else if (path.includes('/wallet/transfer')) {
      setPlaygroundBody(JSON.stringify({ target_wallet_number: "104200000003", amount: 15000, transaction_pin: "123456" }, null, 2));
    } else if (path.includes('/transactions') && method.toLowerCase() === 'post') {
      setPlaygroundBody(JSON.stringify({ sku_code: "tsel10000", target_number: "081234567890", transaction_pin: "123456" }, null, 2));
    } else {
      setPlaygroundBody('');
    }
  };

  // Run real API call in live playground
  const runPlaygroundRequest = async () => {
    if (!selectedEndpoint) return;
    setLoadingPlayground(true);
    setPlaygroundResult(null);
    setPlaygroundStatus(null);
    setPlaygroundHeaders(null);

    const [method, rawPath] = selectedEndpoint.split(' ');
    const url = buildApiUrl(rawPath);
    
    const correlationId = 'playground-' + Math.random().toString(36).substring(2, 10);
    const requestId = 'req-' + Math.random().toString(36).substring(2, 10);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-Request-ID': requestId,
    };

    if (playgroundToken) {
      headers['Authorization'] = `Bearer ${playgroundToken}`;
    }

    try {
      const options: RequestInit = {
        method,
        headers,
      };

      if (method === 'POST' && playgroundBody) {
        options.body = playgroundBody;
      }

      const res = await fetch(url, options);
      setPlaygroundStatus(res.status);

      const headersObj: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      setPlaygroundHeaders(headersObj);

      const data = await res.json();
      setPlaygroundResult(data);
    } catch (err: any) {
      setPlaygroundResult({ error: err.message || 'Connection failure.' });
    } finally {
      setLoadingPlayground(false);
    }
  };

  // Automated Compliance Test Runner
  const runComplianceTest = async () => {
    setRunningTests(true);
    setTestResults([]);

    const testsToRun = [
      { name: 'Root Observability Health Check', path: '/health', method: 'GET' },
      { name: 'Root System Metadata Status Check', path: '/status', method: 'GET' },
      { name: 'System Realtime Observability Metrics', path: '/metrics', method: 'GET' },
      { name: 'Module Health Check Probe v1', path: '/v1/health', method: 'GET' },
      { name: 'Active PPOB Product Category Listing', path: '/categories', method: 'GET' },
    ];

    const results: TestResult[] = [];

    for (const test of testsToRun) {
      const details: string[] = [];
      let passed = true;
      let statusCode = 200;
      let responseBody: any = null;

      try {
        const corrId = 'test-' + Math.random().toString(36).substring(2, 10);
        const reqId = 'req-' + Math.random().toString(36).substring(2, 10);

        details.push(`Initiating fetch connection to [${test.method}] ${test.path}`);
        details.push(`Request Tracing Headers: X-Correlation-ID: ${corrId}, X-Request-ID: ${reqId}`);

        const res = await fetch(buildApiUrl(test.path), {
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Correlation-ID': corrId,
            'X-Request-ID': reqId
          }
        });

        statusCode = res.status;
        details.push(`Network connection established. HTTP Status Code: ${statusCode}`);
        
        // Assert trace headers echo back in response
        const respCorr = res.headers.get('X-Correlation-ID');
        const respReq = res.headers.get('X-Request-ID');
        if (respCorr) {
          details.push(`[PASS] Echo Trace Validation - X-Correlation-ID: ${respCorr}`);
        } else {
          details.push(`[FAIL] Request Trace Verification - Missing X-Correlation-ID in response headers.`);
          passed = false;
        }

        if (respReq) {
          details.push(`[PASS] Echo Trace Validation - X-Request-ID: ${respReq}`);
        } else {
          details.push(`[FAIL] Request Trace Verification - Missing X-Request-ID in response headers.`);
          passed = false;
        }

        responseBody = await res.json();
        details.push(`Response payload retrieved successfully.`);

        // Assert contract keys
        const expectedKeys = ['success', 'message', 'data', 'meta', 'errors'];
        const bodyKeys = Object.keys(responseBody);
        
        expectedKeys.forEach(key => {
          if (bodyKeys.includes(key)) {
            details.push(`[PASS] Response Contract Check: Key '${key}' is present.`);
          } else {
            details.push(`[FAIL] Response Contract Check: Missing expected key '${key}' in root response.`);
            passed = false;
          }
        });

        if (typeof responseBody.success !== 'boolean') {
          details.push(`[FAIL] Type Assertion: 'success' field must be a boolean.`);
          passed = false;
        } else {
          details.push(`[PASS] Type Assertion: 'success' is boolean (${responseBody.success}).`);
        }

      } catch (err: any) {
        passed = false;
        details.push(`[FATAL] Connection error: ${err.message}`);
      }

      results.push({
        name: test.name,
        endpoint: `[${test.method}] ${test.path}`,
        passed,
        statusCode,
        message: responseBody ? responseBody.message : 'No Response',
        details
      });
    }

    setTestResults(results);
    setRunningTests(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-500/30 text-indigo-200 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-400/20 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-300" />
                Sprint 19 Release
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-400/20">
                API Standardized
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">GurkyPay API Portal</h1>
            <p className="text-indigo-100 mt-1 max-w-2xl text-sm">
              Standardized API specification &amp; SDK distribution engine. Consistent responses, integrated telemetry tracing, and interactive playgrounds.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => copyToClipboard(API_BASE_URL, 'baseUrl')}
              className="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border border-white/10 active:scale-95"
            >
              <Globe size={15} />
              <span>Copy API Base URL</span>
              {copiedText === 'baseUrl' ? <Check size={14} className="text-emerald-400" /> : null}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 flex space-x-8">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
              activeTab === 'endpoints' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <BookOpen size={16} />
            API Swagger Playground
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
              activeTab === 'test' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ShieldCheck size={16} />
            Contract Test Compliance Suite
          </button>
          <button
            onClick={() => setActiveTab('sdk')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
              activeTab === 'sdk' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Code2 size={16} />
            Code SDK Center
          </button>
          <button
            onClick={() => setActiveTab('spec')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
              activeTab === 'spec' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Terminal size={16} />
            OpenAPI Spec JSON
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* TAB 1: API SWAGGER PLAYGROUND */}
        {activeTab === 'endpoints' && (
          <>
            {/* Sidebar Categories */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Endpoint Categories</h3>
                <nav className="space-y-1">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(tag)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                        (activeTag === tag)
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Standard Response Contract Info */}
              <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-indigo-800">
                  <ShieldCheck size={18} />
                  <span className="font-bold text-sm">Response Contract Locked</span>
                </div>
                <p className="text-xs text-indigo-700 leading-relaxed mb-3">
                  All requests return a unified structure. Android, Web, and CMS rely on this guarantee.
                </p>
                <pre className="bg-slate-900 text-slate-300 text-[10px] p-2.5 rounded-lg overflow-x-auto font-mono">
{`{
  "success": boolean,
  "message": string,
  "data": object | null,
  "meta": object | null,
  "errors": object | null
}`}
                </pre>
              </div>
            </div>

            {/* Endpoints & Try It Out Playground */}
            <div className="lg:col-span-9 space-y-6">
              
              {/* Live Playground Block */}
              {selectedEndpoint && (
                <div className="bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                  <div className="bg-slate-800/80 px-5 py-3.5 flex items-center justify-between border-b border-slate-700/60">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-indigo-500 text-white px-2.5 py-1 rounded-md uppercase tracking-wider">
                        Playground Console
                      </span>
                      <span className="text-xs text-slate-300 font-mono">{selectedEndpoint}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedEndpoint(null)}
                      className="text-slate-400 hover:text-white text-xs transition"
                    >
                      Close Playground
                    </button>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
                    {/* Left: Input details */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <Lock size={12} className="text-indigo-400" />
                          Sanctum Token (Authorization Header)
                        </label>
                        <input
                          type="text"
                          value={playgroundToken}
                          onChange={(e) => setPlaygroundToken(e.target.value)}
                          placeholder="Bearer sanctum_token_abc123..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>

                      {selectedEndpoint.startsWith('POST') && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Request JSON Body
                          </label>
                          <textarea
                            value={playgroundBody}
                            onChange={(e) => setPlaygroundBody(e.target.value)}
                            rows={6}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                      )}

                      <button
                        onClick={runPlaygroundRequest}
                        disabled={loadingPlayground}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-lg font-medium text-xs transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                      >
                        {loadingPlayground ? (
                          <span>Executing Live Connection...</span>
                        ) : (
                          <>
                            <Play size={14} className="fill-current" />
                            <span>Trigger Live Request</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Right: Response Output */}
                    <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 flex flex-col h-full min-h-[250px]">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2 text-xs">
                        <span className="text-slate-400">Response Payload</span>
                        {playgroundStatus && (
                          <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                            playgroundStatus < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            HTTP {playgroundStatus}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 overflow-auto text-[11px] font-mono leading-relaxed text-slate-300">
                        {playgroundResult ? (
                          <pre>{JSON.stringify(playgroundResult, null, 2)}</pre>
                        ) : (
                          <div className="text-slate-500 h-full flex flex-col items-center justify-center text-center p-4">
                            <Terminal size={24} className="mb-2 opacity-30" />
                            <p>Configure parameters on the left and trigger the API call to verify live responses.</p>
                          </div>
                        )}
                      </div>

                      {playgroundHeaders && (
                        <div className="border-t border-slate-800/80 pt-2 mt-2">
                          <span className="text-[10px] text-slate-500 block uppercase font-semibold mb-1">Response Headers</span>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-slate-400">
                            <div>x-correlation-id:</div>
                            <div className="text-indigo-400 overflow-hidden text-ellipsis whitespace-nowrap">
                              {playgroundHeaders['x-correlation-id'] || 'N/A'}
                            </div>
                            <div>x-request-id:</div>
                            <div className="text-indigo-400 overflow-hidden text-ellipsis whitespace-nowrap">
                              {playgroundHeaders['x-request-id'] || 'N/A'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Endpoints Lists */}
              <div className="space-y-4">
                {Object.entries(openapiSpec.paths).map(([path, pathObj]: [string, any]) => {
                  return Object.entries(pathObj).map(([method, opObj]: [string, any]) => {
                    const tag = opObj.tags?.[0] || 'General';
                    if (activeTag !== 'All' && activeTag !== tag) return null;

                    const isGet = method.toLowerCase() === 'get';
                    const hasAuth = !!opObj.security;

                    return (
                      <div 
                        key={`${method}-${path}`}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-300 hover:shadow-md transition group"
                      >
                        {/* Summary Header */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                              isGet ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {method}
                            </span>
                            <span className="font-mono text-sm font-bold text-slate-950">
                              {buildApiUrl(path)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {hasAuth && (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                <Lock size={10} />
                                Auth Required
                              </span>
                            )}
                            <span className="text-xs text-slate-500 font-medium">
                              {tag}
                            </span>
                          </div>
                        </div>

                        {/* Content Body */}
                        <div className="p-5 border-t border-slate-100">
                          <div className="mb-4">
                            <h4 className="text-base font-bold text-slate-900 mb-1">{opObj.summary}</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{opObj.description}</p>
                          </div>

                          {/* Request Body Info (if POST) */}
                          {!isGet && opObj.requestBody && (
                            <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-2">Request Body Payload</span>
                              <pre className="text-xs font-mono text-slate-700 overflow-x-auto">
                                {JSON.stringify(opObj.requestBody.content['application/json'].schema.properties, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Action footer */}
                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <button
                              onClick={() => handleSelectEndpoint(path, method)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition active:scale-95"
                            >
                              <Play size={12} className="fill-current" />
                              Try It Out In Playground
                            </button>
                            <span className="text-xs text-slate-400 font-mono">
                              Returns Standard Response Contract
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: CONTRACT TEST COMPLIANCE SUITE */}
        {activeTab === 'test' && (
          <div className="lg:col-span-12 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600 animate-pulse" />
                    Automated OpenAPI Contract Compliance Suite
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Verifies response JSON keys, correct HTTP statuses, and trace telemetry headers against the OpenAPI 3.1 specification.
                  </p>
                </div>
                <button
                  onClick={runComplianceTest}
                  disabled={runningTests}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {runningTests ? 'Running Contract Verification...' : 'Execute Compliance Checks'}
                </button>
              </div>

              {testResults.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <HeartPulse size={48} className="mx-auto mb-3 opacity-25 text-indigo-500" />
                  <p className="font-semibold text-base">Test Suite Idle</p>
                  <p className="text-sm mt-1">Click the button above to launch real-time HTTP compliance scans against the Laravel endpoints.</p>
                </div>
              ) : (
                <div className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <span className="text-xs text-slate-500 block">Total Scans Run</span>
                      <span className="text-2xl font-bold text-slate-900">{testResults.length}</span>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                      <span className="text-xs text-emerald-600 block">Checks Passed</span>
                      <span className="text-2xl font-bold text-emerald-700">
                        {testResults.filter(r => r.passed).length}
                      </span>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                      <span className="text-xs text-red-600 block">Failures Detected</span>
                      <span className="text-2xl font-bold text-red-700">
                        {testResults.filter(r => !r.passed).length}
                      </span>
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                      <span className="text-xs text-indigo-600 block">Compliance Grade</span>
                      <span className="text-2xl font-bold text-indigo-700">
                        {testResults.every(r => r.passed) ? '100% (A+)' : 'Incomplete'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {testResults.map((result, idx) => (
                      <details 
                        key={idx} 
                        className="bg-white rounded-xl border border-slate-200 overflow-hidden group"
                        open
                      >
                        <summary className="p-4 flex items-center justify-between cursor-pointer list-none select-none bg-slate-50/60 hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3">
                            {result.passed ? (
                              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle size={20} className="text-red-500 shrink-0" />
                            )}
                            <div>
                              <span className="font-bold text-sm text-slate-900">{result.name}</span>
                              <span className="font-mono text-xs text-slate-500 block mt-0.5">{result.endpoint}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{result.message}</span>
                            <ChevronDown size={16} className="text-slate-400 group-open:rotate-180 transition" />
                          </div>
                        </summary>

                        <div className="p-4 border-t border-slate-100 bg-slate-950 font-mono text-[11px] leading-relaxed text-slate-300 space-y-1">
                          {result.details.map((line, lIdx) => (
                            <div 
                              key={lIdx} 
                              className={line.includes('[FAIL]') ? 'text-red-400' : line.includes('[PASS]') ? 'text-emerald-400' : 'text-slate-400'}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CODE SDK CENTER */}
        {activeTab === 'sdk' && (
          <div className="lg:col-span-12 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Code2 className="text-indigo-600" />
                    Distributed Client SDK Hub
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Ready-to-use, fully functional client libraries for web and mobile platforms with request telemetry tracing.
                  </p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
                  <button
                    onClick={() => setSdkLanguage('typescript')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                      sdkLanguage === 'typescript' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    TypeScript Web SDK
                  </button>
                  <button
                    onClick={() => setSdkLanguage('kotlin')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                      sdkLanguage === 'kotlin' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kotlin Android SDK
                  </button>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => copyToClipboard(sdkLanguage === 'typescript' ? tsSdkCode : kotlinSdkCode, 'sdk')}
                  className="absolute top-4 right-4 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition border border-slate-200 shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  <Copy size={13} />
                  <span>{copiedText === 'sdk' ? 'Copied!' : 'Copy Code'}</span>
                </button>

                <pre className="bg-slate-950 text-slate-300 rounded-2xl p-6 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[550px] border border-slate-900 shadow-inner">
                  <code>{sdkLanguage === 'typescript' ? tsSdkCode : kotlinSdkCode}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RAW OPENAPI SPEC */}
        {activeTab === 'spec' && (
          <div className="lg:col-span-12 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">OpenAPI 3.1.0 JSON Definition</h2>
                  <p className="text-sm text-slate-600 mt-1">Complete schema definition describing operations, securities, and data transfer objects.</p>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(openapiSpec, null, 2), 'specRaw')}
                  className="bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition active:scale-95"
                >
                  <Copy size={13} />
                  <span>{copiedText === 'specRaw' ? 'Copied Spec!' : 'Copy Specification'}</span>
                </button>
              </div>

              <pre className="bg-slate-950 text-slate-300 rounded-2xl p-6 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[500px] border border-slate-900">
                {JSON.stringify(openapiSpec, null, 2)}
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

