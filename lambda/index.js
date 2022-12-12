const Alexa = require("ask-sdk-core");
const b3api = require("./b3api");

const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
} = require("firebase/firestore/lite");

const { projectId, apiKey, appId, authDomain } = process.env;

const app = initializeApp({ projectId, apiKey, appId, authDomain });

const db = getFirestore(app);

const messages = {
  INTERNAL_ERROR: "Não foi possível seguir com sua instrução.",
  GET_EMAIL_PERMISSION:
    "Por favor, habilite as permissões de acesso ao email no aplicativo da alexa.",
  NOT_FOUND_EMAIL:
    "Parece que você não tem um email definido, acesse o aplicativo da alexa para editar.",
  ACCOUNT_NOT_FOUND:
    "Sua conta não foi encontrada na plataforma da financeskill.",
};

const EMAIL_PERMISSION = "alexa::profile:email:read";

const formatNumberToMonetary = (value) =>
  value.toLocaleString("pt-br", { style: "currency", currency: "BRL" });

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Olá, você gostaria de acompanhar seus investimentos?";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const GetInvestmentsInfoIntentHandler = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return (
      request.type === "IntentRequest" &&
      request.intent.name === "GetInvestmentsInfo"
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope, serviceClientFactory, responseBuilder } =
      handlerInput;
    const consentToken =
      requestEnvelope.context.System.user.permissions &&
      requestEnvelope.context.System.user.permissions.consentToken;
    if (!consentToken) {
      return responseBuilder
        .speak(messages.GET_EMAIL_PERMISSION)
        .withAskForPermissionsConsentCard([EMAIL_PERMISSION])
        .getResponse();
    }

    try {
      const upsServiceClient = serviceClientFactory.getUpsServiceClient();
      const profileEmail = await upsServiceClient.getProfileEmail();

      if (!profileEmail) {
        return responseBuilder.speak(messages.NOT_FOUND_EMAIL).getResponse();
      }

      const usersCol = collection(db, "users");
      const usersSnapshot = await getDocs(usersCol);
      const usersList = usersSnapshot.docs.map((doc) => doc.data());

      const user = usersList.find((user) => user.email === profileEmail);

      let output = messages.INTERNAL_ERROR;

      if (!user) {
        output = messages.ACCOUNT_NOT_FOUND;
      }

      const userStocks = user.tickets.map((ticket) => ticket + "4");

      const stocks = await b3api.assets.getAll(userStocks);

      output = stocks.map((stock) => {
        const price = formatNumberToMonetary(stock.price);
        const low = formatNumberToMonetary(stock.low);
        const high = formatNumberToMonetary(stock.high);

        return `O ativo ${stock.ticker} está custando ${price}, com um preço mínimo de ${low}; e máximo de ${high}`;
      });

      return responseBuilder.speak(output.join(". ")).getResponse();
    } catch (error) {
      console.log(error);
      const response = responseBuilder.speak(error.message).getResponse();
      return response;
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "You can say hello to me! How can I help?";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speakOutput = "Goodbye!";

    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Sorry, I don't know about that. Please try again.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    );

    return handlerInput.responseBuilder.getResponse();
  },
};

const IntentReflectorHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
    );
  },
  handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `You just triggered ${intentName}`;

    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput =
      "Sorry, I had trouble doing what you asked. Please try again.";
    console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    GetInvestmentsInfoIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler
  )
  .withApiClient(new Alexa.DefaultApiClient())
  .addErrorHandlers(ErrorHandler)
  .lambda();
