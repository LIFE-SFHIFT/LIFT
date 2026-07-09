package com.lift.domain.lifetransition.service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 정부24/보조금24 공공서비스 Open API(serviceList)에서 혜택 카탈로그를 페이지 단위로 수집한다.
 *
 * <p>런타임 리포트 조회는 DB 캐시({@code gov24_benefit_cache})를 읽지만, 이 클라이언트는
 * 매일 동기화({@link Gov24BenefitSyncService})가 최신 원문을 받아와 DB를 UPSERT할 때 쓴다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class Gov24CatalogClient {

    private final RestClient.Builder restClientBuilder;
    private final Gov24PublicServiceProperties properties;

    /** serviceList 전체(설정된 maxPages/perPage 범위)를 조회해 원본 행 목록을 반환한다. */
    public List<Map<String, Object>> fetchServiceList() {
        RestClient restClient = restClientBuilder.build();
        int maxPages = Math.max(1, properties.getMaxPages());
        int perPage = Math.max(1, properties.getPerPage());
        List<Map<String, Object>> rows = new ArrayList<>();

        for (int page = 1; page <= maxPages; page++) {
            PageRows pageRows = fetchPage(restClient, "serviceList", page, perPage);
            rows.addAll(pageRows.rows());
            if (pageRows.rows().isEmpty() || pageRows.currentCount() < perPage) {
                break;
            }
        }
        return rows;
    }

    private PageRows fetchPage(RestClient restClient, String endpoint, int page, int perPage) {
        URI uri = UriComponentsBuilder
                .fromUriString(StringUtils.trimTrailingCharacter(properties.getBaseUrl(), '/') + "/" + endpoint)
                .queryParam("page", page)
                .queryParam("perPage", perPage)
                .queryParam("returnType", "JSON")
                .queryParam("serviceKey", properties.getServiceKey())
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            Map<String, Object> response = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });

            if (response == null) {
                return new PageRows(List.of(), 0);
            }
            Object code = response.get("code");
            if (code != null && !String.valueOf(code).equals("0")) {
                log.warn("Gov24 serviceList API returned code={} message={}", code, response.get("msg"));
                return new PageRows(List.of(), 0);
            }
            Object data = response.get("data");
            if (!(data instanceof List<?> dataRows)) {
                return new PageRows(List.of(), number(response.get("currentCount")));
            }
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object row : dataRows) {
                if (row instanceof Map<?, ?> map) {
                    result.add(toStringObjectMap(map));
                }
            }
            return new PageRows(result, number(response.get("currentCount")));
        } catch (RestClientException e) {
            log.warn("Gov24 serviceList lookup failed. endpoint={}, page={}", endpoint, page, e);
            return new PageRows(List.of(), 0);
        }
    }

    private Map<String, Object> toStringObjectMap(Map<?, ?> map) {
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private record PageRows(List<Map<String, Object>> rows, int currentCount) {
    }
}
