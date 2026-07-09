package com.lift;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class LiftApplication {

    public static void main(String[] args) {
        SpringApplication.run(LiftApplication.class, args);
    }

}
