import json
import boto3 # type: ignore
from botocore.exceptions import ClientError # type: ignore

dynamodb = boto3.resource('dynamodb')
INVENTORY_TABLE = 'cloudcart-inventory'

# Mapping from frontend product names to DynamoDB PKs
PRODUCT_PK_MAPPING = {
    "Macbook Pro": "PRODUCT#macbook-pro",
    "Dell XPS 15": "PRODUCT#dell-xps",
    "Lenovo H10": "PRODUCT#lenovo-h10",
    "Asus Zenbook": "PRODUCT#asus-zenbook",
    "HP Omen": "PRODUCT#hp-omen"
}

def lambda_handler(event, context):
    table = dynamodb.Table(INVENTORY_TABLE)
    print("ReserveInventory Lambda triggered:", json.dumps(event))

    for record in event.get('Records', []):
        try:
            # Parse SQS body
            message = json.loads(record['body'])

            # Parse SNS envelope
            sns_event = json.loads(message['Message'])

            # Extract EventBridge event details
            detail_type = sns_event.get('detail-type')
            detail = sns_event.get('detail', {})

            product_name = detail.get('product_name')
            quantity = int(detail.get('quantity', 1))

            if not product_name:
                print("No product_name found, skipping record")
                continue

            # Map frontend name to DynamoDB PK
            product_pk = PRODUCT_PK_MAPPING.get(product_name)
            if not product_pk:
                print(f"Unknown product: {product_name}, skipping record")
                continue

            if detail_type == 'OrderPlaced':
                print(f"Decrementing inventory for {product_name} by {quantity}")

                table.update_item(
                    Key={'pk': product_pk},
                    UpdateExpression='SET #qty = #qty - :dec',
                    ConditionExpression='#qty >= :dec',
                    ExpressionAttributeNames={'#qty': 'quantity'},
                    ExpressionAttributeValues={':dec': quantity}
                )

                print(f"Inventory decremented for {product_name}")

            elif detail_type == 'OrderCancelled':
                print(f"Incrementing inventory for {product_name} by {quantity}")

                table.update_item(
                    Key={'pk': product_pk},
                    UpdateExpression='SET #qty = #qty + :inc',
                    ExpressionAttributeNames={'#qty': 'quantity'},
                    ExpressionAttributeValues={':inc': quantity}
                )

                print(f"Inventory incremented for {product_name}")

            else:
                print(f"Unknown detail-type: {detail_type}, skipping record")

        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                print(f"Out of stock for {product_name}")
                continue
            else:
                print("DynamoDB ClientError:", str(e))
                raise e

        except Exception as e:
            print("Error processing record:", str(e))
            raise e
