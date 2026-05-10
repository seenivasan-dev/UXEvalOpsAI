import os
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import RunnableLambda

load_dotenv()


def create_llm():
    """
    Returns AzureChatOpenAI if Azure env vars are set,
    falls back to ChatOpenAI (standard key) otherwise.
    One-line swap for whichever key you have.
    """
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    azure_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    if azure_key and azure_endpoint:
        return AzureChatOpenAI(
            azure_deployment=azure_deployment,
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
            api_version=azure_api_version,
            max_tokens=1500,
        )

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        return ChatOpenAI(model="gpt-4o", api_key=openai_key, max_tokens=1500)

    raise EnvironmentError(
        "No LLM credentials found. Set AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT "
        "or OPENAI_API_KEY in your .env file."
    )


def create_agent_chain(system_prompt: str):
    """
    LangChain pattern: RunnableLambda | llm | parser
    Builds HumanMessage with image + text programmatically to avoid
    ChatPromptTemplate nested-brace formatting errors with base64 data.
    """
    llm = create_llm()
    parser = JsonOutputParser()

    def build_messages(inputs: dict) -> list:
        image_b64 = inputs["image_base64"]
        eval_prompt = inputs["evaluation_prompt"]
        return [
            SystemMessage(content=system_prompt),
            HumanMessage(content=[
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                },
                {"type": "text", "text": eval_prompt},
            ]),
        ]

    return RunnableLambda(build_messages) | llm | parser
