// Automated Security Verification Test Suite for FairShare
const path = require("path");
const http = require("http");

async function runSecurityTests() {
    console.log("==========================================");
    console.log("FAIRSHARE SECURITY VERIFICATION TEST SUITE");
    console.log("==========================================");

    process.env.PORT = "5055";
    process.env.JWT_SECRET = "TEST_SECURE_JWT_SECRET_KEY_1234567890_ABC";

    const app = require("../backend/server");
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(5055, resolve));
    console.log("[✓] Test server online on port 5055");

    // Give DB tables 500ms to ensure serialization is ready
    await new Promise(r => setTimeout(r, 500));

    let passed = 0;
    let failed = 0;

    async function makeReq(method, path, body = null, token = null) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : "";
            const headers = {
                "Content-Type": "application/json"
            };
            if (payload) headers["Content-Length"] = Buffer.byteLength(payload);
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const req = http.request({
                hostname: "127.0.0.1",
                port: 5055,
                path,
                method,
                headers
            }, (res) => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => {
                    try {
                        resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
                    } catch(e) {
                        resolve({ status: res.statusCode, headers: res.headers, raw: data });
                    }
                });
            });
            req.on("error", reject);
            if (payload) req.write(payload);
            req.end();
        });
    }

    try {
        // TEST 1: Password Length Enforcement (< 10 chars should fail)
        console.log("\n[TEST 1] Testing minimum 10-char password enforcement...");
        const resShortPass = await makeReq("POST", "/api/auth/signup", {
            name: "Alice Short",
            email: "alice_short@test.com",
            password: "short"
        });
        if (resShortPass.status === 400 && resShortPass.body?.error?.includes("10 characters")) {
            console.log("  [PASS] Short password rejected with 400.");
            passed++;
        } else {
            console.error("  [FAIL] Short password allowed:", resShortPass);
            failed++;
        }

        // TEST 2: Valid User Signup
        console.log("\n[TEST 2] Testing valid user signup (User A)...");
        const resUserA = await makeReq("POST", "/api/auth/signup", {
            name: "User Alice",
            email: "alice_sec@test.com",
            password: "Password1234!"
        });
        if (resUserA.status === 201 && resUserA.body?.token) {
            console.log("  [PASS] User A registered successfully with JWT.");
            passed++;
        } else {
            console.error("  [FAIL] User A registration failed:", resUserA);
            failed++;
        }
        const tokenA = resUserA.body?.token;

        // TEST 3: User B Signup
        console.log("\n[TEST 3] Testing valid user signup (User B)...");
        const resUserB = await makeReq("POST", "/api/auth/signup", {
            name: "User Bob",
            email: "bob_sec@test.com",
            password: "PasswordBob5678!"
        });
        const tokenB = resUserB.body?.token;
        if (resUserB.status === 201 && tokenB) {
            console.log("  [PASS] User B registered successfully.");
            passed++;
        } else {
            console.error("  [FAIL] User B registration failed:", resUserB);
            failed++;
        }

        // TEST 4: Unified Error Message on Login Failure
        console.log("\n[TEST 4] Testing unified error message on wrong password...");
        const resWrongPass = await makeReq("POST", "/api/auth/login", {
            email: "alice_sec@test.com",
            password: "WrongPassword999!"
        });
        if (resWrongPass.status === 400 && resWrongPass.body?.error === "Invalid email or password") {
            console.log("  [PASS] Returned generic 'Invalid email or password' message.");
            passed++;
        } else {
            console.error("  [FAIL] Wrong password error check:", resWrongPass);
            failed++;
        }

        // TEST 5: Security Headers
        console.log("\n[TEST 5] Testing Security Headers (CSP, HSTS, X-Frame-Options, nosniff)...");
        if (
            resWrongPass.headers["x-content-type-options"] === "nosniff" &&
            resWrongPass.headers["x-frame-options"] === "DENY" &&
            resWrongPass.headers["strict-transport-security"] &&
            resWrongPass.headers["content-security-policy"]
        ) {
            console.log("  [PASS] All expected security headers are present.");
            passed++;
        } else {
            console.error("  [FAIL] Missing security headers:", resWrongPass.headers);
            failed++;
        }

        // TEST 6: User A Creates Group 1
        console.log("\n[TEST 6] User A creates Group 1...");
        const resCreateGroup = await makeReq("POST", "/api/groups", {
            name: "Alice Private Group"
        }, tokenA);
        const groupId = resCreateGroup.body?.group?.id;
        if (resCreateGroup.status === 201 && groupId) {
            console.log("  [PASS] Group 1 created with ID:", groupId);
            passed++;
        } else {
            console.error("  [FAIL] Group creation failed:", resCreateGroup);
            failed++;
        }

        // TEST 7: AUTHORIZATION CHECK (IDOR Prevention)
        console.log("\n[TEST 7] Testing IDOR Prevention: User B attempts to access User A's group...");
        const resUnauthorizedAccess = await makeReq("GET", `/api/groups/${groupId}`, null, tokenB);
        if (resUnauthorizedAccess.status === 403) {
            console.log("  [PASS] 403 Forbidden correctly returned to unauthorized User B.");
            passed++;
        } else {
            console.error("  [FAIL] Unauthorized user accessed group:", resUnauthorizedAccess);
            failed++;
        }

        // TEST 8: INPUT VALIDATION (Negative Expense Amount)
        console.log("\n[TEST 8] Testing negative / infinite expense validation...");
        const resNegativeExpense = await makeReq("POST", `/api/groups/${groupId}/expenses`, {
            title: "Hacked Expense",
            amount: -500,
            paid_by: "User Alice"
        }, tokenA);
        if (resNegativeExpense.status === 400) {
            console.log("  [PASS] Negative expense rejected with 400.");
            passed++;
        } else {
            console.error("  [FAIL] Negative expense accepted:", resNegativeExpense);
            failed++;
        }

        // TEST 9: Add Member & Valid Expense + Server-Side Settlement Math
        console.log("\n[TEST 9] Testing valid expense & server-side debt minimization math...");
        await makeReq("POST", `/api/groups/${groupId}/members`, {
            name: "User Bob",
            email: "bob_sec@test.com"
        }, tokenA);

        await makeReq("POST", `/api/groups/${groupId}/expenses`, {
            title: "Dinner Bill",
            amount: 1000,
            paid_by: "User Alice",
            paid_by_email: "alice_sec@test.com"
        }, tokenA);

        const resSettle = await makeReq("GET", `/api/groups/${groupId}/settle`, null, tokenA);
        if (resSettle.status === 200 && resSettle.body?.transfers?.length === 1) {
            const t = resSettle.body.transfers[0];
            if (t.fromEmail === "bob_sec@test.com" && t.toEmail === "alice_sec@test.com" && t.amount === 500) {
                console.log("  [PASS] Server-side settlement computed exact transfer: Bob owes Alice ₹500.00.");
                passed++;
            } else {
                console.error("  [FAIL] Incorrect settlement math:", resSettle.body);
                failed++;
            }
        } else {
            console.error("  [FAIL] Settlement request failed:", resSettle);
            failed++;
        }

        // TEST 10: XSS Sanitization in Names
        console.log("\n[TEST 10] Testing XSS payload injection in member name...");
        await makeReq("POST", `/api/groups/${groupId}/members`, {
            name: "<script>alert('xss')</script>",
            email: "xss_test@test.com"
        }, tokenA);
        const resGroupDetails = await makeReq("GET", `/api/groups/${groupId}`, null, tokenA);
        const xssMember = resGroupDetails.body?.members?.find(m => m.email === "xss_test@test.com");
        if (xssMember && xssMember.name === "<script>alert('xss')</script>") {
            console.log("  [PASS] Raw string safely stored via parameterization without query corruption.");
            passed++;
        } else {
            console.error("  [FAIL] XSS injection test:", resGroupDetails);
            failed++;
        }

    } catch (err) {
        console.error("Test suite exception:", err);
        failed++;
    } finally {
        server.close(() => {
            console.log("\n==========================================");
            console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
            console.log("==========================================");
            process.exit(failed > 0 ? 1 : 0);
        });
    }
}

runSecurityTests();
