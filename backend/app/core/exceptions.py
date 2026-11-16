from fastapi import HTTPException, status


class PromoFinderException(Exception):
    """Base exception for application errors."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


class EntityNotFoundException(HTTPException):
    def __init__(self, entity_name: str, entity_id: any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} with id {entity_id} not found."
        )


class FileValidationException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class ScreenplayParseException(PromoFinderException):
    """Raised when screenplay parsing encounters malformed syntax."""
    pass


class InvalidTimestampException(PromoFinderException):
    """Raised when timestamps are invalid or do not exist in source."""
    pass


class LLMInferenceException(PromoFinderException):
    """Raised when AI provider call fails or returns malformed response."""
    pass
