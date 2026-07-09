package com.lift.domain.community.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties = {
        "lift.auth.jwt-secret=test-jwt-secret-32-bytes-minimum-value",
        "lift.oauth.mock-enabled=true",
        "lift.oauth.social-enabled=true"
})
@AutoConfigureMockMvc
class CommunityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String accessToken;

    @BeforeEach
    void setUp() throws Exception {
        MvcResult loginResult = mockMvc.perform(get("/api/auth/callback/kakao")
                        .param("code", "community-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andReturn();
        accessToken = readBody(loginResult).at("/result/accessToken").asText();
    }

    @Test
    void 커뮤니티_글_댓글_좋아요_삭제_흐름이_동작한다() throws Exception {
        long postId = createPost();

        mockMvc.perform(authorized(get("/api/community/posts"))
                        .param("category", "JOB_CHANGE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result[0].postId").value((int) postId))
                .andExpect(jsonPath("$.result[0].authorName").value("익명"))
                .andExpect(jsonPath("$.result[0].mine").value(true));

        mockMvc.perform(authorized(post("/api/community/posts/" + postId + "/likes")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.liked").value(true))
                .andExpect(jsonPath("$.result.likeCount").value(1));

        // 중복 좋아요는 카운트를 다시 올리지 않는다.
        mockMvc.perform(authorized(post("/api/community/posts/" + postId + "/likes")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.likeCount").value(1));

        mockMvc.perform(authorized(get("/api/community/posts/popular")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result[0].postId").value((int) postId))
                .andExpect(jsonPath("$.result[0].likeCount").value(1));

        long commentId = createComment(postId);

        MvcResult detailResult = mockMvc.perform(authorized(get("/api/community/posts/" + postId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.liked").value(true))
                .andExpect(jsonPath("$.result.commentCount").value(1))
                .andExpect(jsonPath("$.result.comments[0].authorName").value("익명"))
                .andReturn();

        assertThat(readBody(detailResult).at("/result/comments/0/commentId").asLong()).isEqualTo(commentId);

        mockMvc.perform(authorized(delete("/api/community/posts/" + postId + "/comments/" + commentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(true));

        mockMvc.perform(authorized(delete("/api/community/posts/" + postId + "/likes")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.liked").value(false))
                .andExpect(jsonPath("$.result.likeCount").value(0));

        mockMvc.perform(authorized(delete("/api/community/posts/" + postId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(true));

        mockMvc.perform(authorized(get("/api/community/posts/" + postId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON404_1"));
    }

    @Test
    void 댓글이_남아_있는_글도_삭제할_수_있다() throws Exception {
        long postId = createPost();
        long commentId = createComment(postId);

        mockMvc.perform(authorized(get("/api/community/posts/" + postId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.commentCount").value(1))
                .andExpect(jsonPath("$.result.comments[0].commentId").value((int) commentId));

        mockMvc.perform(authorized(delete("/api/community/posts/" + postId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(true));

        mockMvc.perform(authorized(get("/api/community/posts/" + postId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON404_1"));
    }

    private long createPost() throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("category", "JOB_CHANGE");
        request.put("title", "이직 전 실업급여랑 연차정산 같이 확인해야 하나요?");
        request.put("content", "다음 회사 입사 전까지 놓치면 안 되는 절차가 궁금합니다.");

        MvcResult result = mockMvc.perform(authorized(post("/api/community/posts"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.category").value("JOB_CHANGE"))
                .andExpect(jsonPath("$.result.authorName").value("익명"))
                .andExpect(jsonPath("$.result.mine").value(true))
                .andReturn();

        return readBody(result).at("/result/postId").asLong();
    }

    private long createComment(long postId) throws Exception {
        Map<String, Object> request = Map.of("content", "고용보험 기간도 같이 확인해 보세요.");

        MvcResult result = mockMvc.perform(authorized(post("/api/community/posts/" + postId + "/comments"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.mine").value(true))
                .andReturn();

        return readBody(result).at("/result/commentId").asLong();
    }

    private MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder builder) {
        return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
    }

    private JsonNode readBody(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
