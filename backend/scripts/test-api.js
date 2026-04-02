const API_BASE = 'http://localhost:3000/api/v1';
const ADMIN_API_KEY = '4567c9e607564e91b3898c46d89cb68dc4e40ec4a52b456699b695cf800fd446';

let passed = 0;
let failed = 0;
let testResults = [];

function log(msg) {
  console.log(`  ${msg}`);
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    log(`✓ ${msg}`);
    passed++;
    testResults.push({ test: msg, status: 'PASS', expected, actual });
    return true;
  } else {
    log(`✗ ${msg}`);
    log(`  Expected: ${JSON.stringify(expected)}`);
    log(`  Actual:   ${JSON.stringify(actual)}`);
    failed++;
    testResults.push({ test: msg, status: 'FAIL', expected, actual });
    return false;
  }
}

function assertContains(actual, expected, msg) {
  if (JSON.stringify(actual).includes(JSON.stringify(expected))) {
    log(`✓ ${msg}`);
    passed++;
    testResults.push({ test: msg, status: 'PASS', expected, actual });
    return true;
  } else {
    log(`✗ ${msg}`);
    log(`  Expected to contain: ${JSON.stringify(expected)}`);
    log(`  Actual:   ${JSON.stringify(actual)}`);
    failed++;
    testResults.push({ test: msg, status: 'FAIL', expected, actual });
    return false;
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : options.formData ? options.formData : undefined,
  });

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType && contentType.includes('application/zip')) {
    data = { binary: true, status: response.status };
  } else {
    data = await response.text();
  }

  return { status: response.status, data };
}

async function testTC001() {
  console.log('\nTC-API-001: POST /api/v1/auth/login - Success');
  const { status, data } = await apiRequest('/auth/login', {
    method: 'POST',
    body: { apiKey: ADMIN_API_KEY },
  });
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.ok, true, 'Response ok is true');
  assertEqual(typeof data.data.user.id, 'string', 'User has id');
  assertEqual(typeof data.data.user.name, 'string', 'User has name');
  assertEqual(typeof data.data.token, 'string', 'Response has token');
  return data.data.token;
}

async function testTC002() {
  console.log('\nTC-API-002: POST /api/v1/auth/login - Invalid API Key');
  const { status, data } = await apiRequest('/auth/login', {
    method: 'POST',
    body: { apiKey: 'invalid-api-key' },
  });
  assertEqual(status, 401, 'Status is 401');
  assertEqual(data.ok, false, 'Response ok is false');
}

async function testTC003(token) {
  console.log('\nTC-API-003: GET /api/v1/auth/me - With Token');
  const { status, data } = await apiRequest('/auth/me', { token });
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.ok, true, 'Response ok is true');
  assertEqual(typeof data.data.id, 'string', 'User has id');
  assertEqual(typeof data.data.name, 'string', 'User has name');
  assertEqual(typeof data.data.email, 'string', 'User has email');
}

async function testTC004() {
  console.log('\nTC-API-004: GET /api/v1/auth/me - No Token');
  const { status, data } = await apiRequest('/auth/me');
  assertEqual(status, 401, 'Status is 401');
  assertEqual(data.ok, false, 'Response ok is false');
}

async function testTC005() {
  console.log('\nTC-API-005: GET /api/v1/skills - List');
  const { status, data } = await apiRequest('/skills');
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.ok, true, 'Response ok is true');
  assertEqual(Array.isArray(data.data.skills), true, 'data.skills is array');
  assertEqual(typeof data.data.total, 'number', 'data.total is number');
  assertEqual(typeof data.data.page, 'number', 'data.page is number');
  assertEqual(typeof data.data.pageSize, 'number', 'data.pageSize is number');
}

async function testTC006() {
  console.log('\nTC-API-006: GET /api/v1/skills - Pagination');
  const { status, data } = await apiRequest('/skills?page=1&pageSize=5');
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.data.page, 1, 'Page is 1');
  assertEqual(data.data.pageSize, 5, 'PageSize is 5');
}

async function testTC007() {
  console.log('\nTC-API-007: GET /api/v1/skills - Search');
  const { status, data } = await apiRequest('/skills?keyword=skill-creator');
  assertEqual(status, 200, 'Status is 200');
  assertEqual(Array.isArray(data.data.skills), true, 'data.skills is array');
  assertEqual(data.data.skills.length > 0, true, 'Found skill-creator');
  assertEqual(data.data.skills[0].name, 'skill-creator', 'First result is skill-creator');
}

async function testTC008() {
  console.log('\nTC-API-008: GET /api/v1/skills/:name - Detail');
  const { status, data } = await apiRequest('/skills/skill-creator');
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.ok, true, 'Response ok is true');
  assertEqual(data.data.name, 'skill-creator', 'Skill name is skill-creator');
  assertEqual(typeof data.data.description, 'string', 'Skill has description');
  assertEqual(data.data.publishedBy.id, '438f2767-6b98-4ee8-84c9-1cb86ba681b6', 'Published by admin');
}

async function testTC009() {
  console.log('\nTC-API-009: GET /api/v1/skills/:name - Not Found');
  const { status, data } = await apiRequest('/skills/non-existent-skill-xyz');
  assertEqual(status, 404, 'Status is 404');
  assertEqual(data.ok, false, 'Response ok is false');
  assertEqual(data.msg, 'Skill 不存在', 'Error message is "Skill 不存在"');
}

async function testTC010() {
  console.log('\nTC-API-010: GET /api/v1/skills/:name/download');
  const { status, data } = await apiRequest('/skills/skill-creator/download');
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.binary, true, 'Response is binary');
}

async function testTC011(token) {
  console.log('\nTC-API-011: POST /api/v1/skills - Upload');
  log('⚠ Skipping upload test (requires ZIP file)');
}

async function testTC012(token) {
  console.log('\nTC-API-012: POST /api/v1/skills - Invalid ZIP');
  log('⚠ Skipping invalid ZIP test (requires invalid ZIP file)');
}

async function testTC013(token) {
  console.log('\nTC-API-013: POST /api/v1/skills - Duplicate Upload');
  log('⚠ Skipping duplicate upload test (requires ZIP file)');
}

async function testTC014(token) {
  console.log('\nTC-API-014: DELETE /api/v1/skills/:name');
  log('⚠ Skipping delete test (requires specific skill ownership)');
}

async function testTC015(token) {
  console.log('\nTC-API-015: DELETE /api/v1/skills/:name - No Permission');
  log('⚠ Skipping no-permission delete test (requires specific setup)');
}

async function testTC016(token) {
  console.log('\nTC-API-016: GET /api/v1/users/me/skills');
  const { status, data } = await apiRequest('/users/me/skills', { token });
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.ok, true, 'Response ok is true');
  assertEqual(Array.isArray(data.data), true, 'data is array');
}

async function testTC017() {
  console.log('\nTC-API-017: GET /api/v1/health');
  const { status, data } = await apiRequest('/health');
  assertEqual(status, 200, 'Status is 200');
  assertEqual(data.ok, true, 'Response ok is true');
  assertEqual(data.data.status, 'healthy', 'Status is healthy');
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('Backend API Regression Tests');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    const token = await testTC001();
    await testTC002();
    if (token) {
      await testTC003(token);
      await testTC016(token);
    }
    await testTC004();
    await testTC005();
    await testTC006();
    await testTC007();
    await testTC008();
    await testTC009();
    await testTC010();
    await testTC011();
    await testTC012();
    await testTC013();
    await testTC014();
    await testTC015();
    await testTC017();
  } catch (err) {
    console.error('\nTest error:', err.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total:  ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\nFailed Tests:');
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();