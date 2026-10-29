import com.panaxon.ai.MnemoChatClient;
import com.panaxon.ai.MnemoClient;
import com.panaxon.ai.MnemoNetworkClient;
import com.panaxon.ai.MnemoRAGClient;
import com.panaxon.ai.MnemoSettingsClient;
import com.panaxon.ai.exception.MnemoClientException;
import com.panaxon.ai.exception.MnemoError;

import java.util.Map;

/**
 * Uses the published mnemo-client the way a user would, using only its public API. Exits non-zero if anything is off.
 * MNEMO_API_KEY is optional: without it the live checks still run, with a placeholder key.
 */
public class SmokeTest {
    private static int failures;

    public static void main(String[] args) {
        String key = System.getenv("MNEMO_API_KEY");
        String baseUrl = System.getenv("MNEMO_BASE_URL");

        // every client can be built from its public builder, and only the interface type is needed
        MnemoClient[] built = {
                new MnemoChatClient.Builder().apiKey("k").build(),
                new MnemoRAGClient.Builder().apiKey("k").build(),
                new MnemoSettingsClient.Builder().apiKey("k").build(),
                new MnemoNetworkClient.Builder().apiKey("k").build()};
        check("all four clients build", built.length == 4);

        // a missing parameter is refused locally, with the structured error
        try {
            new MnemoChatClient.Builder().apiKey("k").build().execute();
            check("missing parameters are refused", false);
        } catch (MnemoClientException e) {
            check("missing parameters are refused", e.getError().code() == MnemoError.Code.INVALID_REQUEST);
        }

        // live: the service answers a health check through the real HTTP stack
        try {
            MnemoChatClient.Builder health = new MnemoChatClient.Builder()
                    .apiKey(key == null ? "smoke-test" : key)
                    .operation(MnemoChatClient.Operation.HEALTH);
            if (baseUrl != null) health.baseUrl(baseUrl);
            Map<String, Object> result = health.build().execute();
            check("service health is ok", "ok".equals(result.get("status")));
        } catch (Exception e) {
            check("service health is ok (" + e + ")", false);
        }

        // live: a bad key comes back as HTTP 401 with the matching error code
        try {
            MnemoChatClient.Builder bad = new MnemoChatClient.Builder()
                    .apiKey("not-a-real-token").tenantId("nobody")
                    .operation(MnemoChatClient.Operation.LIST_SUBJECTS);
            if (baseUrl != null) bad.baseUrl(baseUrl);
            bad.build().execute();
            check("a bad key is rejected", false);
        } catch (MnemoClientException e) {
            check("a bad key is rejected as 401 (" + e.getHttpStatus() + ")",
                    e.getHttpStatus() == 401 && e.getError().code() == MnemoError.Code.UNAUTHORIZED);
        }

        System.out.println(failures == 0 ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED: " + failures + " check(s)");
        System.exit(failures == 0 ? 0 : 1);
    }

    private static void check(String what, boolean ok) {
        System.out.println((ok ? "  ok    " : "  FAIL  ") + what);
        if (!ok) failures++;
    }
}
