package com.lift.domain.lifetransition.service;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "lift.public-data.gov24")
public class Gov24PublicServiceProperties {

    /**
     * true면 DB에 적재된 gov24_benefit_cache 후보를 리포트 매칭에 사용한다.
     * serviceKey는 별도 적재 작업이 실시간 API를 호출할 때만 필요하다.
     */
    private boolean enabled = false;

    private String serviceKey;

    private String baseUrl = "https://api.odcloud.kr/api/gov24/v3";

    private int perPage = 1000;

    private int maxPages = 2;

    private int maxKeywords = 5;

    private int maxResults = 6;

    public boolean isAvailable() {
        return enabled;
    }
}
