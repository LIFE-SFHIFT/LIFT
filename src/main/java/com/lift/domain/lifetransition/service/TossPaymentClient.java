package com.lift.domain.lifetransition.service;

import com.lift.domain.lifetransition.exception.LifeTransitionErrorCode;
import com.lift.global.apiPayload.exception.ProjectException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Service
@RequiredArgsConstructor
public class TossPaymentClient {

    private final RestClient.Builder restClientBuilder;
    private final TossPaymentProperties properties;

    public TossPaymentConfirmation confirm(String paymentKey, String orderId, Integer amount) {
        if (!properties.isAvailable()) {
            throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_DISABLED);
        }

        try {
            RestClient restClient = restClientBuilder.build();
            TossPaymentConfirmation confirmation = restClient.post()
                    .uri(properties.getBaseUrl().replaceAll("/+$", "") + "/payments/confirm")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, basicAuthorization())
                    .body(Map.of(
                            "paymentKey", paymentKey,
                            "orderId", orderId,
                            "amount", amount
                    ))
                    .retrieve()
                    .body(TossPaymentConfirmation.class);

            if (confirmation == null
                    || !paymentKey.equals(confirmation.paymentKey())
                    || !orderId.equals(confirmation.orderId())
                    || !amount.equals(confirmation.totalAmount())
                    || !"DONE".equals(confirmation.status())) {
                throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_CONFIRM_FAILED);
            }
            return confirmation;
        } catch (ProjectException e) {
            throw e;
        } catch (RestClientResponseException e) {
            log.warn("Toss payment confirm failed. status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_CONFIRM_FAILED);
        } catch (RestClientException e) {
            log.warn("Toss payment confirm request failed.", e);
            throw new ProjectException(LifeTransitionErrorCode.TOSS_PAYMENT_CONFIRM_FAILED);
        }
    }

    private String basicAuthorization() {
        String credential = properties.getSecretKey() + ":";
        String encoded = Base64.getEncoder().encodeToString(credential.getBytes(StandardCharsets.UTF_8));
        return "Basic " + encoded;
    }
}
