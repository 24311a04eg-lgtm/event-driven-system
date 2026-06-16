import json
import boto3 # type: ignore

cloudwatch = boto3.client('cloudwatch')

# ✅ New namespace to avoid collisions
NAMESPACE = 'NewMetricAnalysis'

def lambda_handler(event, context):
    for record in event.get('Records', []):
        try:
            message = json.loads(record['body'])

            # Handle SNS-wrapped or direct events
            if 'Message' in message:
                inner = json.loads(message['Message'])
                detail_type = inner.get('detail-type')
                detail = inner.get('detail', {})
            else:
                detail_type = message.get('detail-type')
                detail = message.get('detail', {})

            metric_data = []

            # Total Orders Placed
            if detail_type == 'OrderPlaced':
                metric_data.append({
                    'MetricName': 'NewOrdersPlaced',
                    'Value': 1,
                    'Unit': 'Count'
                })

            # Total Orders Cancelled
            elif detail_type == 'OrderCancelled':
                metric_data.append({
                    'MetricName': 'NewOrdersCancelled',
                    'Value': 1,
                    'Unit': 'Count'
                })

            # Out of Stock Events
            elif detail_type == 'OutOfStock':
                metric_data.append({
                    'MetricName': 'NewOutOfStockEvents',
                    'Value': 1,
                    'Unit': 'Count'
                })

            # Push to CloudWatch
            if metric_data:
                cloudwatch.put_metric_data(
                    Namespace=NAMESPACE,
                    MetricData=metric_data
                )
                print(f"Pushed {len(metric_data)} metric(s): {detail_type}")

        except Exception as e:
            print("Error:", str(e))
            raise e

