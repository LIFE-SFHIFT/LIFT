package com.lift.domain.lifetransition.service;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "lift.openai")
public class OpenAiProperties {

    private boolean enabled = false;

    private String apiKey;

    private String baseUrl = "https://api.openai.com/v1";

    private String model = "gpt-5.4-mini";

    public boolean isAvailable() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }
}
