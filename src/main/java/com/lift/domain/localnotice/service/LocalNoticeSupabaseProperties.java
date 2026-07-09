package com.lift.domain.localnotice.service;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 지자체 RSS 파이프라인이 실제로 수집·확정하는 Supabase Postgres 접속 정보.
 *
 * <p>이 앱의 주 데이터소스(회원/리포트/결제 등, {@code spring.datasource.*})와는 완전히 별개의
 * 외부 DB다. 팀원이 별도로 운영하며 지금도 계속 데이터를 채우고 있어, 이 앱은 매 요청마다
 * 그 값을 그대로 읽기만 한다(스냅샷 복사가 아님). url이 비어 있으면(미설정) 기능이 꺼진 것으로
 * 보고 빈 목록을 반환한다({@link LocalNoticeSupabaseReader}).
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "lift.local-notice.datasource")
public class LocalNoticeSupabaseProperties {

    private String url = "";
    private String username = "";
    private String password = "";
}
