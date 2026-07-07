package com.lift.domain.lifetransition.dto.response;

import com.lift.domain.lifetransition.enumtype.PublicBenefitFitLevel;
import com.lift.domain.lifetransition.enumtype.PublicBenefitPriorityGroup;
import com.lift.domain.lifetransition.enumtype.PublicBenefitSourceType;
import java.util.List;

public record PublicBenefitResDTO(
        String title,
        String summary,
        String provider,
        String category,
        String applicationUrl,
        String sourceId,
        String matchedKeyword,
        String reason,
        String sourceLabel,
        PublicBenefitSourceType sourceType,
        PublicBenefitFitLevel fitLevel,
        PublicBenefitPriorityGroup priorityGroup,
        String supportTarget,
        String selectionCriteria,
        String supportContent,
        String applicationMethod,
        String applicationDeadline,
        String contact,
        List<RequiredDocumentResDTO> requiredDocuments,
        List<String> missingInputs,
        String aiSummary,
        int relevanceScore
) {

    public PublicBenefitResDTO withAiRecommendation(
            PublicBenefitFitLevel nextFitLevel,
            PublicBenefitPriorityGroup nextPriorityGroup,
            String nextReason,
            String nextAiSummary,
            List<String> nextMissingInputs,
            int nextRelevanceScore
    ) {
        return new PublicBenefitResDTO(
                title,
                summary,
                provider,
                category,
                applicationUrl,
                sourceId,
                matchedKeyword,
                nextReason == null ? reason : nextReason,
                sourceLabel,
                sourceType,
                nextFitLevel == null ? fitLevel : nextFitLevel,
                nextPriorityGroup == null ? priorityGroup : nextPriorityGroup,
                supportTarget,
                selectionCriteria,
                supportContent,
                applicationMethod,
                applicationDeadline,
                contact,
                requiredDocuments == null ? List.of() : requiredDocuments,
                nextMissingInputs == null ? missingInputs : nextMissingInputs,
                nextAiSummary == null ? aiSummary : nextAiSummary,
                nextRelevanceScore
        );
    }
}
